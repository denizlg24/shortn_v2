import "server-only";
import { minimumPlanFor, type Feature } from "@shortn/billing";
import { cache } from "react";
import type { FeatureAccess, PlanFeatures } from "@/lib/plan-features";
import { billingOverviewAction } from "./actions/billing";

// The layout (sidebar usage) and the page both need it within one request.
export const billingOverview = cache(billingOverviewAction);

const accessTo = (
  features: readonly string[],
  feature: Feature,
): FeatureAccess => ({
  allowed: features.includes(feature),
  plan: minimumPlanFor(feature),
});

export async function featureAccess(
  workspace: string,
  feature: Feature,
): Promise<FeatureAccess> {
  const { features } = await billingOverview(workspace);
  return accessTo(features, feature);
}

export async function planFeatures(workspace: string): Promise<PlanFeatures> {
  const { features } = await billingOverview(workspace);
  return {
    customKeys: accessTo(features, "customKeys"),
    passwords: accessTo(features, "passwords"),
    campaigns: accessTo(features, "campaigns"),
    analyticsBreakdowns: accessTo(features, "analyticsBreakdowns"),
  };
}
