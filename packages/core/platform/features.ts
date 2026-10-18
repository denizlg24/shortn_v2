import { createHash } from "node:crypto";
import type { Documents } from "@shortn/db";

export type PlatformFeature = keyof NonNullable<
  Documents["workspaces"]["platformFeatures"]
>;

// Explicit workspace overrides take precedence over a deterministic cohort.
// The same feature/percentage selects the same workspaces across all services.
export function platformFeatureEnabled(
  workspace: Pick<Documents["workspaces"], "_id" | "platformFeatures">,
  feature: PlatformFeature,
  percentage = 0,
): boolean {
  const override = workspace.platformFeatures?.[feature];
  if (override !== undefined) return override;
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100)
    return false;
  if (percentage === 100) return true;
  const bucket =
    createHash("sha256")
      .update(`p6:${feature}:${workspace._id.toHexString()}`)
      .digest()
      .readUInt32BE(0) % 10_000;
  return bucket < percentage * 100;
}
