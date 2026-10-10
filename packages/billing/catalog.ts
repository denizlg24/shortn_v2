export const CATALOG_VERSION = 2;

export const planIds = ["free", "basic", "plus", "pro", "enterprise"] as const;
export type PlanId = (typeof planIds)[number];

export const features = [
  "customKeys",
  "passwords",
  "campaigns",
  "campaignExport",
  "analyticsBreakdowns",
  "csvExport",
  "qrLogo",
  "api",
  "mcp",
] as const;
export type Feature = (typeof features)[number];

export interface PlanLimits {
  // null = unlimited. Links and QR codes are monthly creation limits.
  links: number | null;
  qrCodes: number | null;
  bioPages: number | null;
  seats: number | null;
  workspaces: number | null;
  analyticsDays: number | null;
  apiPerMinute: number | null;
}

export interface PlanDefinition {
  limits: PlanLimits;
  features: readonly Feature[];
  // New links get the safety interstitial (legacy INTERSTITIAL_PLANS).
  interstitialByDefault: boolean;
  priceUsdMonthly: number | null;
}

// Legacy gates, kept or widened (06: limits only go up): custom keys were
// Pro-only in code although the Basic/Plus product copy promised them;
// passwords, campaign export and bio pages stay Pro+; breakdowns and
// campaigns stay Plus+.
export const plans: Record<PlanId, PlanDefinition> = {
  free: {
    limits: {
      links: 5,
      qrCodes: 5,
      bioPages: 1,
      seats: 1,
      workspaces: 1,
      analyticsDays: 30,
      apiPerMinute: null,
    },
    features: [],
    interstitialByDefault: true,
    priceUsdMonthly: 0,
  },
  basic: {
    limits: {
      links: 50,
      qrCodes: 50,
      bioPages: 2,
      seats: 1,
      workspaces: 1,
      analyticsDays: 365,
      apiPerMinute: 60,
    },
    features: ["customKeys", "api", "mcp"],
    interstitialByDefault: true,
    priceUsdMonthly: 5,
  },
  plus: {
    limits: {
      links: 150,
      qrCodes: 150,
      bioPages: 5,
      seats: 3,
      workspaces: 3,
      analyticsDays: 730,
      apiPerMinute: 300,
    },
    features: [
      "customKeys",
      "campaigns",
      "analyticsBreakdowns",
      "csvExport",
      "api",
      "mcp",
    ],
    interstitialByDefault: false,
    priceUsdMonthly: 15,
  },
  pro: {
    limits: {
      links: null,
      qrCodes: null,
      bioPages: 20,
      seats: 5,
      workspaces: 10,
      analyticsDays: null,
      apiPerMinute: 1200,
    },
    features: [
      "customKeys",
      "passwords",
      "campaigns",
      "campaignExport",
      "analyticsBreakdowns",
      "csvExport",
      "qrLogo",
      "api",
      "mcp",
    ],
    interstitialByDefault: false,
    priceUsdMonthly: 25,
  },
  enterprise: {
    limits: {
      links: null,
      qrCodes: null,
      bioPages: null,
      seats: null,
      workspaces: null,
      analyticsDays: null,
      apiPerMinute: null,
    },
    features,
    interstitialByDefault: false,
    priceUsdMonthly: null,
  },
};

export const planRank: Record<PlanId, number> = {
  free: 0,
  basic: 1,
  plus: 2,
  pro: 3,
  enterprise: 4,
};

export type PolarServer = "sandbox" | "production";

// Every product id that can appear on a non-terminal subscription (06
// §Migration 2). Mapping is by id, never by name.
export const products: Record<
  PolarServer,
  {
    checkout: Record<"basic" | "plus" | "pro", string>;
    legacy: Record<string, PlanId>;
  }
> = {
  production: {
    checkout: {
      basic: "4f84cb1d-574d-419c-b171-34dd270ea15e",
      plus: "0743fb9c-165f-4487-b3b0-802299c69dd5",
      pro: "b00069fc-96e0-40ac-9e06-ced7592b9667",
    },
    legacy: {},
  },
  sandbox: {
    checkout: {
      basic: "eeda3681-3c94-495e-9ba0-47c5e46810ab",
      plus: "b19f9e9a-619c-4b82-a3db-3d09e47e1ad4",
      pro: "2766544c-a057-48bd-9c7b-6122e320989a",
    },
    legacy: {},
  },
};

export function planForProduct(
  server: PolarServer,
  productId: string,
  metadata?: Record<string, unknown>,
): PlanId | undefined {
  const fromMetadata = metadata?.shortn_plan;
  if (
    typeof fromMetadata === "string" &&
    (planIds as readonly string[]).includes(fromMetadata)
  )
    return planIds.find((id) => id === fromMetadata);
  const { checkout, legacy } = products[server];
  for (const [plan, id] of Object.entries(checkout))
    if (id === productId) return planIds.find((p) => p === plan);
  return legacy[productId];
}
