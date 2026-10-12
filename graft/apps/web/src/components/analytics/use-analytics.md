# apps/web/src/components/analytics/use-analytics.ts

- AnalyticsScope · type · L10-L11 — type AnalyticsScope = { type: "workspace" } | { type: "link" | "qr" | "campaign"; id: string };
- AnalyticsRequest · interface · L14-L24 — interface AnalyticsRequest
- AnalyticsStatus · type · L26-L26 — type AnalyticsStatus = "loading" | "ready" | "error";
- Settled · interface · L28-L32 — interface Settled
- useAnalytics · function · L34-L95 — function useAnalytics(workspace: string, request: AnalyticsRequest)
