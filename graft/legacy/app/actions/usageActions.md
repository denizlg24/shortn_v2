# legacy/app/actions/usageActions.ts

- UsageData · type · L7-L28 — type UsageData = { links: { consumed: number; limit: number; balance: number; }; qrCodes: { consumed: number; limit: number; balance: number; }; linkRedirects: { consumed: number; limit: number; balance: number; }; qrCodeRedirects: { consumed: number; limit: number; balance: number; }; };
- getCurrentUsage · function · L30-L106 — async function getCurrentUsage(): Promise<{ success: boolean; data: UsageData | null; plan: string; }>
