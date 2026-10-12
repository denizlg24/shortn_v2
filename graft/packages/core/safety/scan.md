# packages/core/safety/scan.ts

- SafetyStatus · type · L10-L10 — type SafetyStatus = (typeof safetyStatuses)[number];
- WebRiskResult · interface · L23-L26 — interface WebRiskResult
- computeScore · function · L28-L48 — function computeScore(input: { structuralSignals: string[]; webRisk: WebRiskResult; newlyRegistered: boolean; }): { riskScore: number; safetyStatus: SafetyStatus }
- Fetch · type · L50-L50 — type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
- ScanDeps · interface · L52-L55 — interface ScanDeps
- lookupWebRisk · function · L57-L89 — async function lookupWebRisk( url: string, deps: ScanDeps, ): Promise<WebRiskResult>
- domainAgeDays · function · L93-L125 — async function domainAgeDays(hostname: string, deps: ScanDeps)
- ScanOutcome · interface · L127-L133 — interface ScanOutcome
- scanUrl · function · L136-L166 — async function scanUrl( url: string, deps: ScanDeps = {}, ): Promise<ScanOutcome>
