import "server-only";
import type { AdminAction, AdminContext, Result } from "@shortn/core";
import { redirect } from "next/navigation";
import { authorize, authorizeMessages, type AuthorizeError } from "./authorize";
import type { RateClass } from "./rate-limit";

export type ActionState = { error: string } | null;

export const reasonOf = (form: FormData) => {
  const value = form.get("reason");
  return typeof value === "string" ? value.trim().slice(0, 1000) : "";
};

export const textOf = (form: FormData, name: string, max = 2000) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};

/**
 * The body of every console server action: authorize (role, step-up,
 * reason, rate), run the audited core action, then go back to `done` or
 * return a message for the form. `messages` maps the action's own errors.
 */
export async function runAdminAction<E extends string>(
  action: AdminAction,
  form: FormData,
  run: (ctx: AdminContext, reason: string) => Promise<Result<unknown, E>>,
  options: {
    done: string;
    messages?: Partial<Record<E, string>>;
    rate?: RateClass;
    /** Typed confirmation that must equal the `confirm` field. */
    confirm?: string;
  },
): Promise<ActionState> {
  const reason = reasonOf(form);
  if (
    options.confirm !== undefined &&
    textOf(form, "confirm") !== options.confirm
  )
    return { error: `Type ${options.confirm} to confirm.` };
  const authorized = await authorize(action, {
    reason,
    ...(options.rate ? { rate: options.rate } : {}),
  });
  if (!authorized.ok)
    return {
      error: authorizeMessages[authorized.error satisfies AuthorizeError],
    };
  const result = await run(authorized.value, reason);
  if (!result.ok)
    return {
      error:
        options.messages?.[result.error] ??
        `The action failed (${result.error}).`,
    };
  redirect(options.done);
}
