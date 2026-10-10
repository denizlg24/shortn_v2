import type { Feature, PlanId } from "@shortn/billing";

export const gatedFeatures = [
  "customKeys",
  "passwords",
  "campaigns",
  "analyticsBreakdowns",
] as const satisfies readonly Feature[];

export type GatedFeature = (typeof gatedFeatures)[number];

export interface FeatureAccess {
  allowed: boolean;
  /** Cheapest plan that includes the feature, named in the upgrade explanation. */
  plan: PlanId;
}

export type PlanFeatures = Record<GatedFeature, FeatureAccess>;

export const isGatedFeature = (value: unknown): value is GatedFeature =>
  gatedFeatures.some((feature) => feature === value);
