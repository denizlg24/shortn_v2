import { createHash, createHmac } from "node:crypto";
import { UAParser } from "ua-parser-js";
import type { ClickMessage } from "./message";

export interface Enriched {
  browser?: string;
  os?: string;
  device: string;
  refDomain?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  ipHash: string;
  ipPrefix: string;
  uaHash: string;
}

export function ipPrefix(ip: string | undefined): string {
  if (!ip) return "";
  if (ip.includes(".") && !ip.includes(":"))
    return `${ip.split(".").slice(0, 3).join(".")}.0/24`;
  const groups = ip.split("::")[0]?.split(":") ?? [];
  return `${groups.slice(0, 3).join(":")}::/48`;
}

export function hashIp(ip: string | undefined, secret: string): string {
  return ip ? createHmac("sha256", secret).update(ip).digest("hex") : "";
}

function refDomain(referrer: string | undefined) {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

const utmFields = ["source", "medium", "campaign", "term", "content"] as const;

function utm(query: Record<string, string> | undefined) {
  if (!query) return undefined;
  const entries = utmFields.flatMap((field) => {
    const value = query[`utm_${field}`];
    return value ? [[field, value] as const] : [];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function enrich(message: ClickMessage, ipSecret: string): Enriched {
  const ua = new UAParser(message.ua ?? "").getResult();
  const referrerDomain = refDomain(message.referrer);
  const campaign = utm(message.query);
  return {
    ...(ua.browser.name ? { browser: ua.browser.name } : {}),
    ...(ua.os.name ? { os: ua.os.name } : {}),
    // Legacy records every non-mobile/tablet agent as desktop.
    device: ua.device.type || "desktop",
    ...(referrerDomain ? { refDomain: referrerDomain } : {}),
    ...(campaign ? { utm: campaign } : {}),
    ipHash: hashIp(message.ip, ipSecret),
    ipPrefix: ipPrefix(message.ip),
    uaHash: createHash("sha256")
      .update(message.ua ?? "")
      .digest("hex")
      .slice(0, 32),
  };
}
