import "server-only";
import { hashElevationSecret } from "@shortn/core";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";
import { cookieBase, cookieNames, safeNext } from "./request";

/** 23 §1.1 step 1: a nonce held in this browser, sent to the app only as
 * its hash, so a callback token is useless anywhere else. */
export async function startElevation(
  purpose: "login" | "stepup",
  next: string | null,
) {
  const names = cookieNames();
  const jar = await cookies();
  const nonce = randomBytes(32).toString("base64url");
  const maxAge = 5 * 60;
  jar.set(names.nonce, nonce, { ...cookieBase(), maxAge });
  jar.set(names.next, safeNext(next), { ...cookieBase(), maxAge });
  const url = new URL("/admin/elevate", env().APP_URL);
  url.searchParams.set("n", hashElevationSecret(nonce));
  url.searchParams.set("purpose", purpose);
  return url;
}
