import "server-only";
import { minimumPlanFor } from "@shortn/billing";
import { cache } from "react";
import { gatedFeatures, type PlanFeatures } from "@/lib/plan-features";
import { billingOverviewAction } from "./actions/billing";

// The layout (sidebar usage) and the page both need it within one request.
export const billingOverview = cache(billingOverviewAction);

export async function planFeatures(workspace: string): Promise<PlanFeatures> {
  const { features } = await billingOverview(workspace);
  const access = (feature: (typeof gatedFeatures)[number]) => ({
    allowed: features.includes(feature),
    plan: minimumPlanFor(feature),
  });
  return {
    customKeys: access("customKeys"),
    passwords: access("passwords"),
    campaigns: access("campaigns"),
    analyticsBreakdowns: access("analyticsBreakdowns"),
  };
}
