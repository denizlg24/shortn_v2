# apps/web/src/server/actions/analytics.ts

- AnalyticsResult · interface · L52-L68 — interface AnalyticsResult
- validZone · function · L70-L77 — validZone = (zone: string)
- Ctx · type · L85-L85 — type Ctx = Awaited<ReturnType<typeof serviceContext>>;
- ScopeInput · type · L86-L86 — type ScopeInput = z.infer<typeof queryInput>["scope"];
- resolveScope · function · L88-L117 — async function resolveScope(ctx: Ctx, input: ScopeInput)
- narrow · function · L121-L136 — function narrow(scope: AnalyticsScope, filters: Record<string, string>)
- analyticsAction · function · L138-L272 — async function analyticsAction( workspace: string, input: z.input<typeof queryInput>, ): Promise<ActionResult<AnalyticsResult>>
- fetchLimit · function · L188-L189 — fetchLimit = (d: Dimension)
- without · function · L190-L191 — without = (d: Dimension): Filters
