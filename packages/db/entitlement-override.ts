import type { Documents } from "./schemas";

export type EntitlementOverride = NonNullable<
  Documents["workspaces"]["entitlementOverride"]
>;

/** Staff overrides expire on read; the daily sweep only tidies them up
 * (23 §3.4). Shared by billing and the SSO checks, which can't import
 * @shortn/billing. */
export function activeEntitlementOverride(
  override: EntitlementOverride | null | undefined,
  now = new Date(),
): EntitlementOverride | undefined {
  if (!override) return undefined;
  if (override.expiresAt && override.expiresAt.getTime() <= now.getTime())
    return undefined;
  return override;
}

/** A complimentary Enterprise plan satisfies Enterprise-only authority (SSO)
 * exactly like a paid Enterprise subscription. */
export const enterpriseComp = (
  override: EntitlementOverride | null | undefined,
  now = new Date(),
) => activeEntitlementOverride(override, now)?.plan === "enterprise";
