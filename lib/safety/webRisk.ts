import env from "@/utils/env";

export type WebRiskThreatType =
  | "MALWARE"
  | "SOCIAL_ENGINEERING"
  | "UNWANTED_SOFTWARE"
  | "SOCIAL_ENGINEERING_EXTENDED_COVERAGE";

export interface WebRiskResult {
  available: boolean;
  threatTypes: WebRiskThreatType[];
}

const THREAT_TYPES: WebRiskThreatType[] = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
];

/**
 * Google Web Risk Lookup API. Returns the threat types matched for the URL.
 * When no API key is configured the call is skipped (available: false) so
 * local/dev environments fall back to structural-only scoring.
 */
export async function lookupWebRisk(rawUrl: string): Promise<WebRiskResult> {
  const apiKey = env.WEB_RISK_API_KEY;
  if (!apiKey) {
    return { available: false, threatTypes: [] };
  }

  const params = new URLSearchParams();
  params.set("uri", rawUrl);
  params.set("key", apiKey);
  for (const t of THREAT_TYPES) {
    params.append("threatTypes", t);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `https://webrisk.googleapis.com/v1/uris:search?${params.toString()}`,
      {
        method: "GET",
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error("[webRisk] lookup failed with status:", res.status);
      return { available: false, threatTypes: [] };
    }

    const data = (await res.json()) as {
      threat?: { threatTypes?: WebRiskThreatType[] };
    };

    return {
      available: true,
      threatTypes: data.threat?.threatTypes ?? [],
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[webRisk] request timed out");
    } else {
      console.error("[webRisk] request failed or timed out");
    }
    return { available: false, threatTypes: [] };
  }
}
