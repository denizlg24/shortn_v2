import { MongoServerError, ObjectId, type Db } from "mongodb";
import { customAlphabet } from "nanoid";
import { collection, destinationHostRev } from "@shortn/db";
import { fail, ok, type Result } from "../result";
import { isReservedKey } from "../routing";
import { scanUrl, type ScanDeps } from "../safety/scan";

// Anonymous links made by the marketing demo (20 M.5): random non-vanity keys
// on the main domain, no workspace, counted but not tracked, dead after 24 h.
// The document is never purged, so its key stays reserved afterwards.

export const demoLifetimeMs = 24 * 60 * 60 * 1000;
/** Clicks a demo link serves before it stops, so it can't carry a campaign. */
export const demoMaxClicks = 200;

// Longer than workspace keys, so the demo never competes for short ones.
const demoKey = customAlphabet(
  "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
  8,
);

export type DemoLinkError = "invalid_url" | "blocked" | "unavailable";

export interface DemoLink {
  key: string;
  url: string;
  expiresAt: Date;
}

// Demo links live on the root domain, where legacy links may lack `domain`.
async function keyFree(db: Db, domain: string, key: string) {
  const link = await collection(db, "links").findOne(
    {
      $or: [
        { urlCode: key, domain: { $exists: false } },
        { domain, urlCode: key },
        { domain, key },
        { domain, previousKeys: key },
      ],
    },
    { projection: { _id: 1 } },
  );
  return !link;
}

export function parseDemoUrl(input: string): string | null {
  const value = input.trim();
  if (value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function createDemoLink(
  deps: {
    db: Db;
    linkDomain: string;
    /** Hosts a demo link must not point back to (loops and link chains). */
    ownHosts: readonly string[];
    scan: ScanDeps;
    now?: Date;
  },
  input: { url: string },
): Promise<Result<DemoLink, DemoLinkError>> {
  const url = parseDemoUrl(input.url);
  if (!url) return fail("invalid_url");
  const host = new URL(url).hostname.toLowerCase();
  if (
    deps.ownHosts.some(
      (own) =>
        host === own.toLowerCase() || host.endsWith(`.${own.toLowerCase()}`),
    )
  )
    return fail("blocked");

  const scan = await scanUrl(url, deps.scan);
  if (scan.reputationUnavailable) return fail("unavailable");
  if (scan.safetyStatus !== "safe" || scan.disabled) return fail("blocked");

  const now = deps.now ?? new Date();
  const expiresAt = new Date(now.getTime() + demoLifetimeMs);
  for (let attempt = 0; attempt < 6; attempt++) {
    const key = demoKey();
    if (isReservedKey(key)) continue;
    if (!(await keyFree(deps.db, deps.linkDomain, key))) continue;
    try {
      await collection(deps.db, "links").insertOne({
        _id: new ObjectId(),
        domain: deps.linkDomain,
        key,
        longUrl: url,
        destHostRev: destinationHostRev(url) ?? undefined,
        demo: true,
        title: "",
        rules: { expiresAt, maxClicks: demoMaxClicks },
        safetyStatus: scan.safetyStatus,
        riskScore: scan.riskScore,
        scanProvider: scan.scanProvider,
        lastScannedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      return ok({ key, url, expiresAt });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) continue;
      throw error;
    }
  }
  return fail("unavailable");
}
