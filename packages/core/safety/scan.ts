import { validateDestination } from "./structural";
import { z } from "zod";
import { cachedSafetyLookup, safetyDigest, type SafetyCache } from "./cache";

export const safetyStatuses = [
  "pending",
  "safe",
  "suspicious",
  "malicious",
  "blocked",
] as const;
export type SafetyStatus = (typeof safetyStatuses)[number];

export const SUSPICIOUS_THRESHOLD = 50;
export const MALICIOUS_THRESHOLD = 80;

const signalWeights: Record<string, number> = {
  "archive-download": 15,
  "suspicious-tld": 25,
  "deep-subdomain": 10,
  "numeric-host": 20,
  "newly-registered": 25,
};

export interface WebRiskResult {
  available: boolean;
  threatTypes: string[];
}

export function computeScore(input: {
  structuralSignals: string[];
  webRisk: WebRiskResult;
  newlyRegistered: boolean;
}): { riskScore: number; safetyStatus: SafetyStatus } {
  let score = 0;
  for (const signal of input.structuralSignals)
    score += signalWeights[signal] ?? 0;
  if (input.newlyRegistered) score += signalWeights["newly-registered"] ?? 0;
  // Any reputation hit is decisive.
  if (input.webRisk.available && input.webRisk.threatTypes.length > 0)
    score = 100;
  score = Math.min(100, Math.max(0, score));
  const safetyStatus: SafetyStatus =
    score >= MALICIOUS_THRESHOLD
      ? "malicious"
      : score >= SUSPICIOUS_THRESHOLD
        ? "suspicious"
        : "safe";
  return { riskScore: score, safetyStatus };
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface ScanDeps {
  webRiskApiKey?: string | undefined;
  fetch?: Fetch;
  cache?: SafetyCache;
}

async function lookupWebRisk(
  url: string,
  deps: ScanDeps,
): Promise<WebRiskResult> {
  if (!deps.webRiskApiKey) return { available: false, threatTypes: [] };
  const hostname = new URL(url).hostname;
  const key = `safety:v1:host:${safetyDigest(hostname)}:web-risk:${safetyDigest(deps.webRiskApiKey)}:${safetyDigest(url)}`;
  return cachedSafetyLookup(
    deps.cache,
    key,
    z.object({
      available: z.literal(true),
      threatTypes: z.array(z.string()).min(1),
    }),
    () => requestWebRisk(url, deps),
  );
}

async function requestWebRisk(
  url: string,
  deps: ScanDeps,
): Promise<{ value: WebRiskResult; expiresAt?: number }> {
  const unavailable = { value: { available: false, threatTypes: [] } };
  const params = new URLSearchParams({ uri: url, key: deps.webRiskApiKey! });
  for (const type of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"])
    params.append("threatTypes", type);
  try {
    const response = await (deps.fetch ?? fetch)(
      `https://webrisk.googleapis.com/v1/uris:search?${params}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return unavailable;
    const body: unknown = await response.json();
    const threat =
      body && typeof body === "object"
        ? Reflect.get(body, "threat")
        : undefined;
    const types =
      threat && typeof threat === "object"
        ? Reflect.get(threat, "threatTypes")
        : undefined;
    const value = {
      available: true,
      threatTypes: Array.isArray(types)
        ? types.filter((t): t is string => typeof t === "string")
        : [],
    };
    const expiresAt =
      threat && typeof threat === "object"
        ? Date.parse(String(Reflect.get(threat, "expireTime")))
        : NaN;
    // Lookup API supplies expiry only for unsafe URL matches. Never generalize
    // a clean path to its host or invent a negative-cache lifetime.
    return {
      value,
      ...(value.threatTypes.length && Number.isFinite(expiresAt)
        ? { expiresAt }
        : {}),
    };
  } catch {
    return unavailable;
  }
}

const newDomainDays = 30;

async function domainAgeDays(hostname: string, deps: ScanDeps) {
  const domain = hostname.replace(/^www\./, "");
  const registeredAt = await cachedSafetyLookup<number | null>(
    deps.cache,
    `safety:v1:host:${safetyDigest(domain)}:rdap`,
    z.number().finite().nonnegative(),
    async () => {
      const value = await registrationDate(domain, deps);
      return {
        value,
        ...(value !== null ? { expiresAt: Date.now() + 86400000 } : {}),
      };
    },
  );
  return registeredAt === null
    ? null
    : Math.floor((Date.now() - registeredAt) / 86_400_000);
}

async function registrationDate(
  domain: string,
  deps: ScanDeps,
): Promise<number | null> {
  try {
    const response = await (deps.fetch ?? fetch)(
      `https://rdap.org/domain/${domain}`,
      {
        headers: { Accept: "application/rdap+json" },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const events =
      body && typeof body === "object"
        ? Reflect.get(body, "events")
        : undefined;
    if (!Array.isArray(events)) return null;
    for (const event of events) {
      if (
        event &&
        typeof event === "object" &&
        Reflect.get(event, "eventAction") === "registration"
      ) {
        const date = new Date(String(Reflect.get(event, "eventDate")));
        if (Number.isNaN(date.getTime()) || date.getTime() > Date.now())
          return null;
        return date.getTime();
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface ScanOutcome {
  reputationUnavailable?: boolean;
  riskScore: number;
  safetyStatus: SafetyStatus;
  disabled: boolean;
  disabledReason?: string;
  scanProvider: string;
}

// Same scoring as legacy lib/safety so both apps reach the same verdicts.
export async function scanUrl(
  url: string,
  deps: ScanDeps = {},
): Promise<ScanOutcome> {
  const structural = validateDestination(url);
  if (!structural.ok)
    return {
      riskScore: 100,
      safetyStatus: "malicious",
      disabled: true,
      disabledReason: `structural:${structural.reason}`,
      scanProvider: "structural",
    };
  const [webRisk, ageDays] = await Promise.all([
    lookupWebRisk(url, deps),
    domainAgeDays(new URL(url).hostname, deps),
  ]);
  const { riskScore, safetyStatus } = computeScore({
    structuralSignals: structural.signals,
    webRisk,
    newlyRegistered: ageDays !== null && ageDays < newDomainDays,
  });
  const disabled = riskScore >= MALICIOUS_THRESHOLD;
  return {
    riskScore,
    safetyStatus,
    disabled,
    ...(disabled ? { disabledReason: "auto:malicious-score" } : {}),
    scanProvider: webRisk.available ? "google-web-risk" : "structural",
    ...(deps.webRiskApiKey && !webRisk.available
      ? { reputationUnavailable: true }
      : {}),
  };
}
