"use server";

import {
  can,
  createApiKey,
  platformFeatureEnabled,
  revokeApiKey,
  rollApiKey,
} from "@shortn/core";
import { hasFeature, loadEntitlements } from "@shortn/billing";
import { revalidatePath } from "next/cache";
import { serviceContext } from "../context";
import { env } from "../env";
import { parseApiKeyForm } from "../api-key-form";

export type ApiKeyActionResult =
  | { ok: true; secret?: string; name?: string }
  | { ok: false; error: string; field?: string };

async function authorizedContext(workspace: string) {
  const ctx = await serviceContext(workspace),
    config = env();
  if (!can(ctx.actor, "apiKeys.manage"))
    return { ok: false, error: "forbidden" } as const;
  if (
    config.PLATFORM_API_ENABLED !== "1" ||
    !config.API_KEY_PEPPER ||
    !platformFeatureEnabled(ctx.workspace, "api", config.PLATFORM_API_ROLLOUT)
  )
    return { ok: false, error: "disabled" } as const;
  return { ok: true, ctx, pepper: config.API_KEY_PEPPER } as const;
}

export async function createApiKeyAction(
  workspace: string,
  form: FormData,
): Promise<ApiKeyActionResult> {
  const auth = await authorizedContext(workspace);
  if (!auth.ok) return auth;
  // New keys follow the plan; existing keys keep working and can be rotated or revoked.
  if (
    !hasFeature(
      await loadEntitlements(auth.ctx.db, auth.ctx.workspace._id),
      "api",
    )
  )
    return { ok: false, error: "feature_required" };
  const input = parseApiKeyForm(form);
  if (!input.ok) return input;
  const result = await createApiKey(auth.ctx, input.value, auth.pepper);
  if (!result.ok) return result;
  revalidatePath(`/${workspace}/settings/api-keys`);
  return { ok: true, secret: result.value.secret, name: result.value.key.name };
}

export async function rollApiKeyAction(
  workspace: string,
  id: string,
): Promise<ApiKeyActionResult> {
  const auth = await authorizedContext(workspace);
  if (!auth.ok) return auth;
  const result = await rollApiKey(auth.ctx, id, auth.pepper);
  if (!result.ok) return result;
  revalidatePath(`/${workspace}/settings/api-keys`);
  return { ok: true, secret: result.value.secret, name: result.value.key.name };
}

export async function revokeApiKeyAction(
  workspace: string,
  id: string,
): Promise<ApiKeyActionResult> {
  const ctx = await serviceContext(workspace);
  // Revocation remains available when API access is switched off.
  const result = await revokeApiKey(ctx, id);
  if (!result.ok) return result;
  revalidatePath(`/${workspace}/settings/api-keys`);
  return { ok: true };
}
