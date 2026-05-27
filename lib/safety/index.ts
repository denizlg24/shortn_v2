import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { validateDestination } from "./structural";
import { lookupWebRisk } from "./webRisk";
import { getDomainAge, isNewlyRegistered } from "./rdap";
import { computeScore, MALICIOUS_THRESHOLD } from "./score";

export { validateDestination } from "./structural";
export {
  SUSPICIOUS_THRESHOLD,
  MALICIOUS_THRESHOLD,
  computeScore,
} from "./score";

export interface ScanOutcome {
  riskScore: number;
  safetyStatus: string;
  disabled: boolean;
  disabledReason?: string;
  scanProvider: string;
}

/**
 * Runs the full reputation scan for a URL and returns the resulting safety
 * fields. Pure: does not touch the database. Combines structural soft-signals,
 * Google Web Risk, and best-effort domain age.
 */
export async function scanUrl(rawUrl: string): Promise<ScanOutcome> {
  const structural = validateDestination(rawUrl);

  // A URL that fails structural validation should never have been persisted,
  // but if a re-scan encounters one, treat it as malicious.
  if (!structural.ok) {
    return {
      riskScore: 100,
      safetyStatus: "malicious",
      disabled: true,
      disabledReason: `structural:${structural.reason}`,
      scanProvider: "structural",
    };
  }

  let hostname = "";
  try {
    hostname = new URL(rawUrl).hostname;
  } catch {
    /* validated above */
  }

  const [webRisk, domainAge] = await Promise.all([
    lookupWebRisk(rawUrl),
    getDomainAge(hostname),
  ]);

  const newlyRegistered = isNewlyRegistered(domainAge.ageDays);

  const { riskScore, safetyStatus } = computeScore({
    structuralSignals: structural.signals,
    webRisk,
    newlyRegistered,
  });

  const provider = webRisk.available ? "google-web-risk" : "structural";

  return {
    riskScore,
    safetyStatus,
    disabled: riskScore >= MALICIOUS_THRESHOLD,
    disabledReason:
      riskScore >= MALICIOUS_THRESHOLD ? "auto:malicious-score" : undefined,
    scanProvider: provider,
  };
}

/**
 * Scans a stored link by urlCode and persists the result. Used by the
 * post-create `after()` hook and the moderation cron.
 */
export async function scanAndPersist(urlCode: string): Promise<void> {
  await connectDB();
  const doc = await UrlV3.findOne({ urlCode });
  if (!doc) return;

  const outcome = await scanUrl(doc.longUrl);

  doc.riskScore = outcome.riskScore;
  // Do not downgrade a link already blocked by reports/manual moderation.
  if (doc.safetyStatus !== "blocked") {
    doc.safetyStatus = outcome.safetyStatus as typeof doc.safetyStatus;
  }
  if (outcome.disabled && !doc.disabled) {
    doc.disabled = true;
    doc.flagged = true;
    doc.disabledReason = outcome.disabledReason;
  }
  doc.scanProvider = outcome.scanProvider;
  doc.lastScannedAt = new Date();

  await doc.save();
}
