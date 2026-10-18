import type { Feature, PlanId } from "@shortn/billing";

export const gatedFeatures = [
  "customKeys",
  "passwords",
  "campaigns",
  "analyticsBreakdowns",
] as const satisfies readonly Feature[];

export type GatedFeature = (typeof gatedFeatures)[number];

/** Features with an upgrade explanation in the `gate` catalog. */
export type ExplainedFeature =
  | GatedFeature
  | "qrLogo"
  | "csvExport"
  | "campaignExport"
  | "api"
  | "sso"
  | "bioBadge"
  | "bioSchedule"
  | "bioBranding";

export interface FeatureAccess {
  allowed: boolean;
  /** Cheapest plan that includes the feature, named in the upgrade explanation. */
  plan: PlanId;
}

export type PlanFeatures = Record<GatedFeature, FeatureAccess>;

export const isGatedFeature = (value: unknown): value is GatedFeature =>
  gatedFeatures.some((feature) => feature === value);

/** The gate a component needs: the plan to name, or null when included. */
export const gateOf = (access: FeatureAccess): PlanId | null =>
  access.allowed ? null : access.plan;
