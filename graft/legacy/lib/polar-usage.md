# legacy/lib/polar-usage.ts

- MeterEvent · type · L10-L10 — type MeterEvent = (typeof METER_EVENTS)[keyof typeof METER_EVENTS];
- ingestUsageEvent · function · L39-L67 — async function ingestUsageEvent({ customerId, eventName, metadata = {}, }: { customerId: string; eventName: MeterEvent; metadata?: Record<string, string | number | boolean>; })
- getStartOfMonth · function · L69-L74 — function getStartOfMonth(): Date
- countEventsThisMonth · function · L76-L106 — async function countEventsThisMonth( customerId: string, eventName: MeterEvent, ): Promise<{ count: number; success: boolean }>
- MeterData · type · L108-L113 — type MeterData = { consumedUnits: number; creditedUnits: number; balance: number; meterName: string; };
- getCustomerMeters · function · L115-L146 — async function getCustomerMeters(customerId: string): Promise<{ success: boolean; meters: Record<string, MeterData>; error?: unknown; }>
- canPerformAction · function · L148-L189 — async function canPerformAction( customerId: string, meterEvent: MeterEvent, plan: string, ): Promise<{ allowed: boolean; balance: number; limit: number; consumed: number; }>
- getUsageSummary · function · L191-L259 — async function getUsageSummary(customerId: string, plan: string)
