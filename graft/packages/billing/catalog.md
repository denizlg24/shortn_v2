# packages/billing/catalog.ts

- PlanId · type · L4-L4 — type PlanId = (typeof planIds)[number];
- Feature · type · L17-L17 — type Feature = (typeof features)[number];
- PlanLimits · interface · L19-L28 — interface PlanLimits
- PlanDefinition · interface · L30-L36 — interface PlanDefinition
- PolarServer · type · L140-L140 — type PolarServer = "sandbox" | "production";
- planForProduct · function · L169-L184 — function planForProduct( server: PolarServer, productId: string, metadata?: Record<string, unknown>, ): PlanId | undefined
