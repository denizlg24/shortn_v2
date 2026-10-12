# legacy/hooks/use-polar-usage.tsx

- MeterData · type · L13-L18 — type MeterData = { consumedUnits: number; creditedUnits: number; balance: number; meterName: string; };
- UsageData · type · L20-L25 — type UsageData = { linksThisMonth: MeterData | null; qrCodesThisMonth: MeterData | null; linkRedirectsThisMonth: MeterData | null; qrCodeRedirectsThisMonth: MeterData | null; };
- usePolarUsage · function · L27-L86 — function usePolarUsage()
- getUsageRemaining · function · L88-L91 — function getUsageRemaining(meterData: MeterData | null): number
- getUsageConsumed · function · L93-L96 — function getUsageConsumed(meterData: MeterData | null): number
- getUsageLimit · function · L98-L101 — function getUsageLimit(meterData: MeterData | null): number
- canPerformAction · function · L103-L106 — function canPerformAction(meterData: MeterData | null): boolean
