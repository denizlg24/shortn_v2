import "server-only";
import { safeNext } from "@shortn/auth";
import { redirect } from "next/navigation";
import { getSession } from "./auth";

// Auth pages send signed-in visitors on, to `next` when it's a safe in-app
// path (an invite link) and to their workspace otherwise. Pages do this, not
// the (auth) layout, because layouts can't read search params.
export async function leaveIfSignedIn(next: string | string[] | undefined) {
  if (await getSession())
    redirect(safeNext(typeof next === "string" ? next : undefined));
}
