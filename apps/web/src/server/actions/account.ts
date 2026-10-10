"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "../auth";
import { requireSession } from "../workspace";
import type { ActionResult } from "./result";

// better-auth only exposes setPassword on the server: it adds an email +
// password sign-in to an account that so far only has OAuth providers.
export async function setPasswordAction(
  newPassword: string,
): Promise<ActionResult<null>> {
  if (!z.string().min(8).max(128).safeParse(newPassword).success)
    return { ok: false, error: "invalid_input" };
  await requireSession();
  try {
    await auth().api.setPassword({
      body: { newPassword },
      headers: await headers(),
    });
    return { ok: true, data: null };
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "body" in error &&
      error.body &&
      typeof error.body === "object" &&
      "code" in error.body
        ? String(error.body.code)
        : "failed";
    return { ok: false, error: code };
  }
}
