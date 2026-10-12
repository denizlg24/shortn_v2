# apps/web/src/lib/plan-features.ts

- GatedFeature · type · L10-L10 — type GatedFeature = (typeof gatedFeatures)[number];
- ExplainedFeature · type · L13-L14 — type ExplainedFeature = GatedFeature | "qrLogo" | "csvExport" | "campaignExport";
- FeatureAccess · interface · L16-L20 — interface FeatureAccess
- PlanFeatures · type · L22-L22 — type PlanFeatures = Record<GatedFeature, FeatureAccess>;
- isGatedFeature · function · L24-L25 — isGatedFeature = (value: unknown): value is GatedFeature
- gateOf · function · L28-L29 — gateOf = (access: FeatureAccess): PlanId | null
