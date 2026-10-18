import {
  minimumPlanFor,
  planIds,
  plans,
  type Feature,
  type PlanId,
} from "@shortn/billing/catalog";

/** What a tour step's feature needs beyond the workspace's current plan. */
export type StepRequirement =
  | { kind: "feature"; feature: Feature }
  /** Inviting people needs a plan with more than one seat. */
  | { kind: "seats" }
  /** Custom domains need a paid plan plus one add-on per domain. */
  | { kind: "domainAddon" };

export type StepAccess =
  | { locked: false }
  | {
      locked: true;
      /** Cheapest plan that unlocks the step, or null when the current plan already does. */
      plan: PlanId | null;
      /** The plan alone is not enough: the step also needs a paid add-on. */
      addon: boolean;
    };

export interface AccessContext {
  plan: PlanId;
  /** Domain add-ons this workspace can still use; unknown until loaded. */
  domainAllowance: number | null;
}

const cheapestPlan = (test: (plan: PlanId) => boolean): PlanId =>
  planIds.find(test) ?? "enterprise";

const multiSeat = (plan: PlanId) => {
  const seats = plans[plan].limits.seats;
  return seats === null || seats > 1;
};

const unlocked: StepAccess = { locked: false };

export function stepAccess(
  requirement: StepRequirement | undefined,
  { plan, domainAllowance }: AccessContext,
): StepAccess {
  if (!requirement) return unlocked;
  switch (requirement.kind) {
    case "feature":
      return plans[plan].features.includes(requirement.feature)
        ? unlocked
        : {
            locked: true,
            plan: minimumPlanFor(requirement.feature),
            addon: false,
          };
    case "seats":
      return multiSeat(plan)
        ? unlocked
        : { locked: true, plan: cheapestPlan(multiSeat), addon: false };
    case "domainAddon":
      if (plan === "free")
        return {
          locked: true,
          plan: cheapestPlan((id) => id !== "free"),
          addon: true,
        };
      return domainAllowance === 0
        ? { locked: true, plan: null, addon: true }
        : unlocked;
  }
}

/**
 * How a locked step is labelled: the plan to upgrade to, that plan plus a
 * domain add-on, or only the add-on when the plan already allows domains.
 */
export type StepBadge =
  | { kind: "plan"; plan: PlanId }
  | { kind: "planAddon"; plan: PlanId }
  | { kind: "addon" };

export function stepBadge(access: StepAccess): StepBadge | null {
  if (!access.locked) return null;
  if (!access.plan) return { kind: "addon" };
  return { kind: access.addon ? "planAddon" : "plan", plan: access.plan };
}
