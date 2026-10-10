import "server-only";
import { hashIp } from "@shortn/core";
import { headers } from "next/headers";
import { env } from "./env";

// The edge Worker forwards Cloudflare's client IP; it's only ever stored as
// an HMAC (reports, password rate limits).
export async function visitorIpHash() {
  const h = await headers();
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return hashIp(ip, env().IP_HASH_SECRET);
}
