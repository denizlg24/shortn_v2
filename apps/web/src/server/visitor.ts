import "server-only";
import { hashIp } from "@shortn/core";
import { headers } from "next/headers";
import { visitorIp } from "./client-ip";
import { env } from "./env";

// Only ever stored as an HMAC (reports, password rate limits).
export async function visitorIpHash() {
  const e = env();
  const ip = visitorIp(await headers(), {
    edge: e.WEB_EDGE_AUTH_SECRET,
    bio: e.BIO_INTERNAL_SECRET,
  });
  return hashIp(ip, e.IP_HASH_SECRET);
}
