"use server";

import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  redeliverWebhook,
} from "@shortn/core";
import { revalidatePath } from "next/cache";
import { serviceContext } from "../context";
import { env } from "../env";
export type WebhookActionResult =
  | {
      ok: true;
      secret?: string;
      name?: string;
      notice: "saved" | "queued" | "deleted";
    }
  | { ok: false; error: string };
function config() {
  const value = env();
  return {
    enabled: value.PLATFORM_WEBHOOKS_ENABLED === "1",
    secretKey: value.WEBHOOK_SECRET_KEY ?? "",
    rolloutPercent: value.PLATFORM_WEBHOOKS_ROLLOUT,
  };
}
export async function saveWebhookAction(
  workspace: string,
  id: string | null,
  form: FormData,
): Promise<WebhookActionResult> {
  const ctx = await serviceContext(workspace);
  const input = {
    name: form.get("name"),
    url: form.get("url"),
    events: form.getAll("events"),
    enabled: form.get("enabled") === "on",
  };
  if (id) {
    const result = await updateWebhook(ctx, id, input, config());
    if (!result.ok) return result;
    revalidatePath(`/${workspace}/settings/webhooks`);
    return { ok: true, notice: "saved" };
  }
  const result = await createWebhook(ctx, input, config());
  if (!result.ok) return result;
  revalidatePath(`/${workspace}/settings/webhooks`);
  return {
    ok: true,
    notice: "saved",
    secret: result.value.secret,
    name: result.value.name,
  };
}
export async function webhookOperationAction(
  workspace: string,
  id: string,
  operation: "delete" | "enable" | "disable" | "test" | "redeliver",
  deliveryId?: string,
): Promise<WebhookActionResult> {
  const ctx = await serviceContext(workspace);
  const result =
    operation === "delete"
      ? await deleteWebhook(ctx, id)
      : operation === "test"
        ? await testWebhook(ctx, id, config())
        : operation === "redeliver" && deliveryId
          ? await redeliverWebhook(ctx, id, deliveryId, config())
          : operation === "enable" || operation === "disable"
            ? await updateWebhook(
                ctx,
                id,
                { enabled: operation === "enable" },
                config(),
              )
            : { ok: false as const, error: "invalid_input" };
  if (!result.ok) return result;
  revalidatePath(`/${workspace}/settings/webhooks`);
  return {
    ok: true,
    notice:
      operation === "delete"
        ? "deleted"
        : operation === "test" || operation === "redeliver"
          ? "queued"
          : "saved",
  };
}
