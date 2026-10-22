"use server";

import { acceptInvite } from "@shortn/core";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../db";
import { impersonationOf, requireSession } from "../workspace";
import { invalidInput, type ActionResult } from "./result";

// Invite tokens are 32 random bytes in base64url (packages/core members.ts).
const token = z.string().regex(/^[\w-]{16,128}$/);

/** Joins the invite's workspace, then lands the user in it. */
export async function acceptInviteAction(
  input: string,
): Promise<ActionResult<null>> {
  const parsed = token.safeParse(input);
  if (!parsed.success) return invalidInput;
  const session = await requireSession();
  // Joining a workspace is the user's own decision, never staff's.
  if (impersonationOf(session)) return { ok: false, error: "forbidden" };
  const result = await acceptInvite(await db(), parsed.data, {
    id: session.user.id,
    email: session.user.email,
  });
  if (!result.ok) return { ok: false, error: result.error };
  redirect(`/${result.value.slug}/links`);
}
