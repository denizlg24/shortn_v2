import type { SafetyStatus } from "@/models/url/UrlV3";
import type { WebRiskResult } from "./webRisk";

export const SUSPICIOUS_THRESHOLD = 50;
export const MALICIOUS_THRESHOLD = 80;

const SIGNAL_WEIGHTS: Record<string, number> = {
  "archive-download": 15,
  "suspicious-tld": 25,
  "deep-subdomain": 10,
  "numeric-host": 20,
  "newly-registered": 25,
};

export interface ScoreInput {
  structuralSignals: string[];
  webRisk: WebRiskResult;
  newlyRegistered: boolean;
}

export interface ScoreOutput {
  riskScore: number;
  safetyStatus: SafetyStatus;
}

export function computeScore(input: ScoreInput): ScoreOutput {
  let score = 0;

  for (const signal of input.structuralSignals) {
    score += SIGNAL_WEIGHTS[signal] ?? 0;
  }

  if (input.newlyRegistered) {
    score += SIGNAL_WEIGHTS["newly-registered"];
  }

  if (input.webRisk.available && input.webRisk.threatTypes.length > 0) {
    // Any reputation hit is treated as decisive.
    score = 100;
  }

  score = Math.min(100, Math.max(0, score));

  let safetyStatus: SafetyStatus;
  if (score >= MALICIOUS_THRESHOLD) {
    safetyStatus = "malicious";
  } else if (score >= SUSPICIOUS_THRESHOLD) {
    safetyStatus = "suspicious";
  } else {
    safetyStatus = "safe";
  }

  return { riskScore: score, safetyStatus };
}
