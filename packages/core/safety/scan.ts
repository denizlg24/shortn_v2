import { validateDestination } from "./structural";

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
}

async function lookupWebRisk(
  url: string,
  deps: ScanDeps,
): Promise<WebRiskResult> {
  if (!deps.webRiskApiKey) return { available: false, threatTypes: [] };
  const params = new URLSearchParams({ uri: url, key: deps.webRiskApiKey });
  for (const type of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"])
    params.append("threatTypes", type);
  try {
    const response = await (deps.fetch ?? fetch)(
      `https://webrisk.googleapis.com/v1/uris:search?${params}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return { available: false, threatTypes: [] };
    const body: unknown = await response.json();
    const threat =
      body && typeof body === "object"
        ? Reflect.get(body, "threat")
        : undefined;
    const types =
      threat && typeof threat === "object"
        ? Reflect.get(threat, "threatTypes")
        : undefined;
    return {
      available: true,
      threatTypes: Array.isArray(types)
        ? types.filter((t): t is string => typeof t === "string")
        : [],
    };
  } catch {
    return { available: false, threatTypes: [] };
  }
}

const newDomainDays = 30;

async function domainAgeDays(hostname: string, deps: ScanDeps) {
  const domain = hostname.replace(/^www\./, "");
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
        if (Number.isNaN(date.getTime())) return null;
        return Math.floor((Date.now() - date.getTime()) / 86_400_000);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface ScanOutcome {
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
  };
}
