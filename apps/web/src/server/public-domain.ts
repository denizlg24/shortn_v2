import "server-only";
import { headers } from "next/headers";
import { activeDomain } from "@shortn/core";
import { notFound } from "next/navigation";
import { db } from "./db";
import { env } from "./env";
export async function publicRequestDomain() {
  const e = env(),
    h = await headers();
  const forwarded =
    h.get("x-shortn-forwarded-host") ?? h.get("x-forwarded-host");
  if (
    !forwarded ||
    forwarded === e.LINK_DOMAIN ||
    forwarded === new URL(e.PUBLIC_ORIGIN).host
  )
    return e.LINK_DOMAIN;
  if (
    !e.BIO_INTERNAL_SECRET ||
    h.get("x-bio-auth") !== e.BIO_INTERNAL_SECRET ||
    !(await activeDomain(await db(), forwarded))
  )
    notFound();
  return forwarded;
}
