import { describe, expect, test } from "bun:test";
import {
  features,
  minimumPlanFor,
  planIds,
  planRank,
  plans,
} from "@shortn/billing/catalog";
import { stepAccess, stepBadge, type StepRequirement } from "./access";
import { tourSteps } from "./steps";

const context = (plan: (typeof planIds)[number], domainAllowance = 1) => ({
  plan,
  domainAllowance,
});

describe("step access", () => {
  test("steps without a requirement are open on every plan", () => {
    for (const plan of planIds)
      expect(stepAccess(undefined, context(plan))).toEqual({ locked: false });
  });

  test.each(features.map((feature) => [feature] as const))(
    "%s locks below its cheapest plan and names that plan",
    (feature) => {
      const requirement: StepRequirement = { kind: "feature", feature };
      const unlocksAt = minimumPlanFor(feature);
      expect(plans[unlocksAt].features).toContain(feature);
      for (const plan of planIds) {
        const access = stepAccess(requirement, context(plan));
        if (plans[plan].features.includes(feature))
          expect(access).toEqual({ locked: false });
        else {
          expect(access).toEqual({
            locked: true,
            plan: unlocksAt,
            addon: false,
          });
          expect(planRank[unlocksAt]).toBeGreaterThan(planRank[plan]);
        }
      }
    },
  );

  test("inviting people needs a plan with more than one seat", () => {
    const firstTeamPlan = planIds.find((plan) => {
      const seats = plans[plan].limits.seats;
      return seats === null || seats > 1;
    });
    expect(firstTeamPlan).toBeDefined();
    for (const plan of planIds) {
      const access = stepAccess({ kind: "seats" }, context(plan));
      const seats = plans[plan].limits.seats;
      expect(access).toEqual(
        seats === null || seats > 1
          ? { locked: false }
          : { locked: true, plan: firstTeamPlan ?? null, addon: false },
      );
    }
  });

  test("custom domains need a paid plan and an add-on", () => {
    const requirement: StepRequirement = { kind: "domainAddon" };
    expect(stepAccess(requirement, context("free"))).toEqual({
      locked: true,
      plan: "basic",
      addon: true,
    });
    expect(stepAccess(requirement, context("plus", 0))).toEqual({
      locked: true,
      plan: null,
      addon: true,
    });
    expect(stepAccess(requirement, context("plus", 2))).toEqual({
      locked: false,
    });
    expect(
      stepAccess(requirement, { plan: "pro", domainAllowance: null }),
    ).toEqual({ locked: false });
  });
});

describe("step badges", () => {
  test("name the plan, the plan plus an add-on, or only the add-on", () => {
    expect(stepBadge({ locked: false })).toBeNull();
    expect(stepBadge({ locked: true, plan: "pro", addon: false })).toEqual({
      kind: "plan",
      plan: "pro",
    });
    expect(stepBadge({ locked: true, plan: "basic", addon: true })).toEqual({
      kind: "planAddon",
      plan: "basic",
    });
    expect(stepBadge({ locked: true, plan: null, addon: true })).toEqual({
      kind: "addon",
    });
  });

  test("every gated step is locked on Free and badged with a paid plan", () => {
    for (const step of tourSteps) {
      if (!("requirement" in step)) continue;
      const badge = stepBadge(stepAccess(step.requirement, context("free", 0)));
      expect({ step: step.id, badge: badge?.kind ?? null }).not.toEqual({
        step: step.id,
        badge: null,
      });
      if (badge && badge.kind !== "addon") expect(badge.plan).not.toBe("free");
    }
  });

  test("nothing is locked on Enterprise with a domain add-on to spare", () => {
    for (const step of tourSteps)
      expect(
        stepAccess(
          "requirement" in step ? step.requirement : undefined,
          context("enterprise"),
        ),
      ).toEqual({ locked: false });
  });
});
