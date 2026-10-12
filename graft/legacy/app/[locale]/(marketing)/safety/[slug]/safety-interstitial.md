# legacy/app/[locale]/(marketing)/safety/[slug]/safety-interstitial.tsx

- SafetyStatus · type · L29-L29 — type SafetyStatus = "pending" | "safe" | "suspicious" | "malicious" | "blocked";
- StatusBadge · function · L31-L54 — function StatusBadge({ status }: { status: SafetyStatus })
- SafetyInterstitial · function · L56-L185 — function SafetyInterstitial({ slug, destinationUrl, destinationDomain, creatorName, createdAt, safetyStatus, riskScore, }: { slug: string; destinationUrl: string; destinationDomain: string; creatorName: string | null; createdAt: string; safetyStatus: SafetyStatus; riskScore: number; })
