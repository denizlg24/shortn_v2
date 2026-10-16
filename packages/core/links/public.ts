import { collection, physicalNames } from "@shortn/db";
import { invalidateLinks, type InvalidationStore } from "@shortn/redis";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import type { Db, Document } from "mongodb";
import {
  withMutation,
  recordWebhookEvent,
  linkEventData,
} from "../webhooks/events";

// Public pages a visitor reaches from the redirect: the password prompt, the
// safety interstitial and the report form (14: these move to web in P4).

export interface PublicLink {
  key: string;
  destination: string;
  destinationHost: string;
  passwordHint: string | null;
  passwordProtected: boolean;
  blocked: boolean;
  disabledReason: string | null;
  safetyStatus: string;
  createdAt: string;
  creatorName: string | null;
}
export function publicLinkQuery(
  key: string,
  domain = "shortn.at",
  rootDomain = "shortn.at",
) {
  const lookup =
    domain === rootDomain
      ? {
          $or: [
            { urlCode: key, domain: { $exists: false } },
            { urlCode: key, domain: rootDomain },
            { key, domain: rootDomain },
          ],
        }
      : { domain, key, domainInactive: { $ne: true } };
  return { $and: [lookup, { deletedAt: { $exists: false } }] };
}

export async function publicLink(
  db: Db,
  key: string,
  domain = "shortn.at",
  rootDomain = "shortn.at",
): Promise<PublicLink | null> {
  const doc = await db
    .collection(physicalNames.links)
    .findOne(publicLinkQuery(key, domain, rootDomain));
  if (!doc || typeof doc.longUrl !== "string") return null;
  let destinationHost = doc.longUrl;
  try {
    destinationHost = new URL(doc.longUrl).hostname;
  } catch {
    /* shown verbatim */
  }
  const creator =
    typeof doc.sub === "string"
      ? await db
          .collection(physicalNames.user)
          .findOne({ sub: doc.sub }, { projection: { name: 1 } })
      : null;
  const date = doc.date instanceof Date ? doc.date : doc._id.getTimestamp();
  return {
    key,
    destination: doc.longUrl,
    destinationHost,
    passwordHint:
      typeof doc.passwordHint === "string" ? doc.passwordHint : null,
    passwordProtected: Boolean(doc.passwordProtected && doc.passwordHash),
    blocked: Boolean(
      doc.disabled ||
      doc.safetyStatus === "blocked" ||
      doc.safetyStatus === "malicious",
    ),
    disabledReason:
      typeof doc.disabledReason === "string" ? doc.disabledReason : null,
    safetyStatus:
      typeof doc.safetyStatus === "string" ? doc.safetyStatus : "pending",
    createdAt: date.toISOString(),
    creatorName: typeof creator?.name === "string" ? creator.name : null,
  };
}

export interface CounterStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
}

async function bump(store: CounterStore, key: string, seconds: number) {
  const count = await store.incr(key);
  if (count === 1) await store.expire(key, seconds);
  return count;
}

export type PasswordResult =
  | { ok: true; token: string }
  | {
      ok: false;
      error: "not_found" | "not_protected" | "rate_limited" | "wrong_password";
    };

// 03: 5 attempts per minute per IP+key, 50 per hour per key. Successful
// attempts clear the IP counter, like legacy's resetRateLimit.
export async function verifyLinkPassword(
  deps: {
    db: Db;
    counters: CounterStore;
    linkAccessSecret: string;
    rootDomain?: string;
  },
  input: { key: string; password: string; ipHash: string; domain?: string },
): Promise<PasswordResult> {
  const doc = await deps.db
    .collection(physicalNames.links)
    .findOne(publicLinkQuery(input.key, input.domain, deps.rootDomain), {
      projection: { passwordProtected: 1, passwordHash: 1 },
    });
  if (!doc) return { ok: false, error: "not_found" };
  if (!doc.passwordProtected || typeof doc.passwordHash !== "string")
    return { ok: false, error: "not_protected" };
  const scope =
    input.domain && input.domain !== (deps.rootDomain ?? "shortn.at")
      ? `${input.domain}:${input.key}`
      : input.key;
  const ipKey = `pwd:ip:${input.ipHash}:${scope}`;
  const linkKey = `pwd:link:${scope}`;
  const [perIp, perLink] = await Promise.all([
    bump(deps.counters, ipKey, 60),
    bump(deps.counters, linkKey, 3600),
  ]);
  if (perIp > 5 || perLink > 50) return { ok: false, error: "rate_limited" };
  if (!(await bcrypt.compare(input.password, doc.passwordHash)))
    return { ok: false, error: "wrong_password" };
  await deps.counters.del(ipKey);
  const token = await new SignJWT({ urlCode: scope })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(new TextEncoder().encode(deps.linkAccessSecret));
  return { ok: true, token };
}

// Same claims as legacy lib/confirmation-token.ts; the redirect accepts the
// dedicated secret alongside legacy's during coexistence.
export function confirmationToken(key: string, secret: string) {
  return new SignJWT({ slug: key, purpose: "link-confirmation" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}

export const reportReasons = [
  "phishing",
  "malware",
  "spam",
  "inappropriate",
  "other",
] as const;
export type ReportReason = (typeof reportReasons)[number];

// Port of legacy reportLink: one report per IP per link, 5 per IP per day,
// and the third report disables the link pending review.
export async function reportLink(
  deps: {
    db: Db;
    counters: CounterStore;
    cache: InvalidationStore;
    linkDomain: string;
    rootDomain?: string;
  },
  input: {
    key: string;
    reason: ReportReason;
    details?: string | undefined;
    ipHash: string;
  },
): Promise<{ ok: true } | { ok: false; error: "not_found" | "rate_limited" }> {
  const day = new Date().toISOString().slice(0, 10);
  const links = deps.db.collection(physicalNames.links);
  const doc = await links.findOne(
    publicLinkQuery(input.key, deps.linkDomain, deps.rootDomain),
    { projection: { _id: 1 } },
  );
  if (!doc) return { ok: false, error: "not_found" };
  const reports = deps.db.collection(physicalNames.link_reports);
  if (await reports.findOne({ linkId: doc._id, reporterIpHash: input.ipHash }))
    return { ok: true };
  if ((await bump(deps.counters, `report:${input.ipHash}:${day}`, 86_400)) > 5)
    return { ok: false, error: "rate_limited" };
  const updated = await withMutation(deps.db, async (session) => {
    const current = await collection(deps.db, "links").findOne(
      { _id: doc._id, deletedAt: { $exists: false } },
      { session },
    );
    if (!current) return null;
    if (
      await reports.findOne(
        { linkId: current._id, reporterIpHash: input.ipHash },
        { session },
      )
    )
      return current;
    const now = new Date();
    await reports.insertOne(
      {
        linkId: current._id,
        ...(current.workspaceId ? { workspaceId: current.workspaceId } : {}),
        domain: deps.linkDomain,
        urlCode: input.key,
        reason: input.reason,
        ...(input.details?.trim()
          ? { details: input.details.trim().slice(0, 1000) }
          : {}),
        reporterIpHash: input.ipHash,
        status: "open",
        createdAt: now,
      },
      { session },
    );
    const count = Number(current.reportCount ?? 0) + 1;
    const blocking = count >= 3 && !current.disabled;
    const mutation: Document = {
      $inc: { reportCount: 1, "safety.reportCount": 1 },
      ...(blocking
        ? {
            $set: {
              disabled: true,
              flagged: true,
              safetyStatus: "blocked",
              disabledReason: "auto:report-threshold",
              "safety.disabled": true,
              "safety.flagged": true,
              "safety.status": "blocked",
              "safety.disabledReason": "auto:report-threshold",
              updatedAt: now,
            },
          }
        : {}),
    };
    const saved = await collection(deps.db, "links").findOneAndUpdate(
      { _id: current._id },
      mutation,
      { session, returnDocument: "after" },
    );
    if (saved && blocking) {
      const workspaceId =
        current.workspaceId ??
        (current.sub
          ? (
              await collection(deps.db, "workspaces").findOne(
                { personal: true, legacySub: current.sub },
                { session, projection: { _id: 1 } },
              )
            )?._id
          : undefined);
      if (workspaceId)
        await recordWebhookEvent(
          deps.db,
          workspaceId,
          "link.updated",
          linkEventData(saved, deps.linkDomain),
          session,
          now,
        );
    }
    return saved;
  });
  if (!updated) return { ok: false, error: "not_found" };
  await invalidateLinks(deps.cache, updated.domain ?? deps.linkDomain, [
    input.key,
    updated.key ?? updated.urlCode ?? "",
    ...(updated.previousKeys ?? []),
  ]);
  return { ok: true };
}
