# legacy/lib/safety/webRisk.ts

- WebRiskThreatType · type · L3-L7 — type WebRiskThreatType = | "MALWARE" | "SOCIAL_ENGINEERING" | "UNWANTED_SOFTWARE" | "SOCIAL_ENGINEERING_EXTENDED_COVERAGE";
- WebRiskResult · interface · L9-L12 — interface WebRiskResult
- lookupWebRisk · function · L25-L74 — async function lookupWebRisk(rawUrl: string): Promise<WebRiskResult>
