# legacy/hooks/use-plan.tsx

- SubscriptionStatus · type · L9-L9 — type SubscriptionStatus = "free" | "active" | "trialing" | "past_due";
- PlanData · interface · L11-L15 — interface PlanData
- PlanContextValue · interface · L17-L25 — interface PlanContextValue
- fetcher · function · L31-L37 — fetcher = async (): Promise<PlanData>
- PlanProvider · function · L39-L80 — function PlanProvider({ children }: { children: ReactNode })
- clearPlanCache · function · L65-L67 — clearPlanCache = ()
- usePlan · function · L82-L88 — function usePlan()
- clearPlanCacheGlobal · function · L90-L92 — function clearPlanCacheGlobal()
