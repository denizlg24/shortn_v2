import { hasFeature, loadEntitlements, type Feature } from "@shortn/billing";
import {
  collection,
  deriveLink,
  physicalNames,
  type Documents,
} from "@shortn/db";
import { invalidateLinks } from "@shortn/redis";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { ObjectId, type Document, type Filter } from "mongodb";
import { archiveLegacyClicks } from "../legacy-clicks";
import { fail, ok, type Result } from "../result";
import type { LinkSort, LinkStatusFilter } from "./filters";
import { isReservedKey } from "../routing";
import { scanUrl, type ScanDeps } from "../safety/scan";
import { validateDestination } from "../safety/structural";
import { embeddedTags, ensureTags, tagName } from "../tags/service";
import { countUsage } from "../usage/service";
import { can } from "../workspaces/authz";
import { legacySubOf, nowOf, type ServiceContext } from "../workspaces/context";
import { ownedBy, parseObjectId } from "../workspaces/service";

type Link = Documents["links"];

export const keyPattern = /^[A-Za-z0-9_-]{1,64}$/;
// Same alphabet and length as legacy's nanoid(6).
const generateKey = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-",
  6,
);

export interface LinkView {
  id: string;
  domain: string;
  key: string;
  url: string;
  title: string;
  description: string | null;
  tags: { id: string; name: string }[];
  clicks: number;
  lastClickAt: string | null;
  createdAt: string;
  createdBy: string | null;
  password: { hint: string | null } | null;
  safety: { status: string; disabled: boolean; interstitial: boolean };
  qrCodeId: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    term: string | null;
    content: string | null;
  }[];
}

// Legacy fields are authoritative during coexistence (02 §3a.1), so views
// read them first and fall back to the derived ones.
export function toLinkView(link: Link, linkDomain: string): LinkView {
  const created = link.createdAt ?? link.date ?? link._id.getTimestamp();
  return {
    id: link._id.toHexString(),
    domain: link.domain ?? linkDomain,
    key: link.urlCode ?? link.key ?? "",
    url: link.longUrl ?? link.destination ?? "",
    title: link.title ?? "",
    description: link.description ?? null,
    tags: (link.tags ?? []).flatMap((tag) => {
      const name = tagName(tag);
      return name
        ? [{ id: tag.id ?? (tag._id ? tag._id.toHexString() : name), name }]
        : [];
    }),
    clicks: link.clicks?.total ?? link.stats?.clicks ?? 0,
    lastClickAt:
      (link.clicks?.lastClick ?? link.stats?.lastClickAt)?.toISOString() ??
      null,
    createdAt: created.toISOString(),
    createdBy: link.createdBy ?? null,
    password: link.passwordProtected
      ? { hint: link.passwordHint ?? null }
      : null,
    safety: {
      status: link.safetyStatus ?? link.safety?.status ?? "pending",
      disabled: Boolean(link.disabled ?? link.safety?.disabled),
      interstitial: Boolean(
        link.requiresInterstitial ?? link.safety?.interstitial,
      ),
    },
    qrCodeId: link.qrCodeId || null,
    utm: (link.utmLinks ?? []).map((variant) => {
      const text = (value: unknown) =>
        typeof value === "string" && value ? value : null;
      return {
        source: text(variant.source),
        medium: text(variant.medium),
        campaign: text(variant.campaign?.title),
        term: text(variant.term),
        content: text(variant.content),
      };
    }),
  };
}

export type LinkError =
  | "forbidden"
  | "invalid_url"
  | "unsafe_destination"
  | "invalid_key"
  | "key_reserved"
  | "key_taken"
  | "feature_required"
  | "limit_reached"
  | "not_found";

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function checkDestination(input: string) {
  const url = normalizeUrl(input);
  if (url.length > 2048) return fail("invalid_url");
  const structural = validateDestination(url);
  if (!structural.ok)
    return structural.reason === "invalid-url" ||
      structural.reason === "invalid-protocol"
      ? fail("invalid_url")
      : fail("unsafe_destination", { reason: structural.reason ?? null });
  return ok(url);
}

async function keyAvailable(
  ctx: ServiceContext,
  key: string,
  except?: ObjectId,
  domain = ctx.linkDomain,
) {
  const clash = await collection(ctx.db, "links").findOne(
    {
      ...(except ? { _id: { $ne: except } } : {}),
      $or: [
        ...(domain === ctx.linkDomain
          ? [{ urlCode: key, domain: { $exists: false } }]
          : []),
        { domain, urlCode: key },
        { domain, key },
        { domain, previousKeys: key },
      ],
    },
    { projection: { _id: 1 } },
  );
  return !clash;
}

async function checkKey(
  ctx: ServiceContext,
  key: string,
  except?: ObjectId,
  domain = ctx.linkDomain,
) {
  if (!keyPattern.test(key)) return fail("invalid_key");
  if (isReservedKey(key)) return fail("key_reserved", { key });
  if (!(await keyAvailable(ctx, key, except, domain)))
    return fail("key_taken", { key });
  return ok(key);
}

async function freshKey(ctx: ServiceContext, domain = ctx.linkDomain) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const key = generateKey();
    if (
      !isReservedKey(key) &&
      (await keyAvailable(ctx, key, undefined, domain))
    )
      return key;
  }
  throw new Error("Could not generate a free link key");
}

const featureGate = (feature: Feature) => fail("feature_required", { feature });

// The fields M3 would derive from these legacy fields, with M3's hash, so a
// write by either app looks identical and the continuous migration skips it.
function derive(legacy: Document) {
  const { set, unset, legacyHash } = deriveLink(legacy);
  const fields: Document = {};
  for (const [field, value] of Object.entries(set))
    if (!field.startsWith("_sync.")) fields[field] = value;
  return { fields, unset, legacyHash };
}

function withDerived(legacy: Document) {
  const { fields, unset, legacyHash } = derive(legacy);
  const $set: Document = {
    ...fields,
    "_sync.legacyHash": legacyHash,
    "_sync.lastWriter": "v2",
  };
  return { $set, $unset: unset };
}

export interface CreateLinkInput {
  domain?: string | undefined;
  url: string;
  key?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  tags?: string[] | undefined;
  password?: string | undefined;
  passwordHint?: string | undefined;
}

export async function createLink(
  ctx: ServiceContext,
  input: CreateLinkInput,
): Promise<Result<LinkView, LinkError>> {
  if (!can(ctx.actor, "resource.create")) return fail("forbidden");
  const domain = input.domain ?? ctx.linkDomain;
  if (domain !== ctx.linkDomain) {
    const { activeDomain } = await import("../domains/service");
    const custom = await activeDomain(ctx.db, domain);
    if (
      !custom ||
      String(custom.workspaceId) !== String(ctx.workspace._id) ||
      custom.kind === "bio"
    )
      return fail("forbidden");
  }
  const destination = checkDestination(input.url);
  if (!destination.ok) return destination;
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);

  let key: string;
  if (input.key?.trim()) {
    if (!hasFeature(entitlements, "customKeys"))
      return featureGate("customKeys");
    const checked = await checkKey(ctx, input.key.trim(), undefined, domain);
    if (!checked.ok) return checked;
    key = checked.value;
  } else key = await freshKey(ctx, domain);

  if (input.password && !hasFeature(entitlements, "passwords"))
    return featureGate("passwords");

  const now = nowOf(ctx);
  const sub = legacySubOf(ctx);
  const tags = await ensureTags(ctx, input.tags ?? []);
  const url = destination.value;
  const legacy: Document = {
    _id: new ObjectId(),
    ...(sub ? { sub } : {}),
    domain,
    urlCode: key,
    customCode: Boolean(input.key?.trim()),
    longUrl: url,
    isQrCode: false,
    title: input.title?.trim() || `${new URL(url).hostname} - untitled`,
    date: now,
    tags: embeddedTags(tags, sub),
    utmLinks: [],
    clicks: { total: 0, lastClick: null },
    passwordProtected: Boolean(input.password),
    ...(input.password
      ? {
          passwordHash: await bcrypt.hash(input.password, 10),
          ...(input.passwordHint?.trim()
            ? { passwordHint: input.passwordHint.trim().slice(0, 100) }
            : {}),
        }
      : {}),
    riskScore: 0,
    safetyStatus: "pending",
    flagged: false,
    disabled: false,
    reportCount: 0,
    lastScannedAt: null,
    requiresInterstitial: entitlements.interstitialByDefault,
  };
  const derived = derive(legacy);
  const doc: Document = {
    ...legacy,
    ...derived.fields,
    workspaceId: ctx.workspace._id,
    tagIds: tags.map((tag) => tag._id),
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : {}),
    previousKeys: [],
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.actor.userId,
    _sync: { rev: 1, lastWriter: "v2", legacyHash: derived.legacyHash },
  };

  const links = collection(ctx.db, "links");
  try {
    await ctx.db.collection(physicalNames.links).insertOne(doc);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("key_taken", { key });
    throw error;
  }
  const limit = entitlements.limits.links;
  if (limit !== null) {
    const usage = await countUsage(ctx.db, ctx.workspace, entitlements.period);
    if (usage.links > limit) {
      await links.deleteOne({ _id: doc._id });
      return fail("limit_reached", { limit, used: usage.links - 1 });
    }
  }
  await invalidateLinks(ctx.cache, domain, [key]);
  const created = await links.findOne({ _id: doc._id });
  if (!created) throw new Error("Created link vanished");
  return ok(toLinkView(created, ctx.linkDomain));
}

export interface UpdateLinkInput {
  url?: string | undefined;
  key?: string | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
  tags?: string[] | undefined;
  password?: string | undefined;
  passwordHint?: string | null | undefined;
  removePassword?: boolean | undefined;
}

async function findOwned(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const _id = parseObjectId(id);
  if (!_id) return null;
  return collection(ctx.db, "links").findOne({
    $and: [{ _id }, ownedBy<Link>(ctx.workspace)],
  });
}

export async function getLink(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  id: string,
) {
  const link = await findOwned(ctx, id);
  return link ? toLinkView(link, ctx.linkDomain) : null;
}

export async function updateLink(
  ctx: ServiceContext,
  id: string,
  input: UpdateLinkInput,
): Promise<Result<LinkView, LinkError>> {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden");
  const link = await findOwned(ctx, id);
  if (!link) return fail("not_found");
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const legacy: Document = { ...link };
  const set: Document = {};
  const oldKey = link.urlCode ?? link.key;

  if (input.url !== undefined && input.url.trim() !== link.longUrl) {
    const destination = checkDestination(input.url);
    if (!destination.ok) return destination;
    legacy.longUrl = destination.value;
    set.longUrl = destination.value;
    // A changed destination is unscanned again (legacy rescans in after()).
    legacy.safetyStatus =
      link.safetyStatus === "blocked" ? "blocked" : "pending";
    set.safetyStatus = legacy.safetyStatus;
  }
  let newKey: string | undefined;
  if (
    input.key !== undefined &&
    input.key.trim() &&
    input.key.trim() !== oldKey
  ) {
    if (!hasFeature(entitlements, "customKeys"))
      return featureGate("customKeys");
    const checked = await checkKey(
      ctx,
      input.key.trim(),
      link._id,
      link.domain ?? ctx.linkDomain,
    );
    if (!checked.ok) return checked;
    newKey = checked.value;
    legacy.urlCode = newKey;
    set.urlCode = newKey;
    set.customCode = true;
  }
  if (input.title !== undefined) {
    legacy.title = input.title.trim();
    set.title = legacy.title;
  }
  if (input.description !== undefined)
    set.description = input.description?.trim() || undefined;
  if (input.tags !== undefined) {
    const tags = await ensureTags(ctx, input.tags);
    set.tags = embeddedTags(tags, legacySubOf(ctx));
    set.tagIds = tags.map((tag) => tag._id);
  }
  if (input.removePassword) {
    Object.assign(legacy, {
      passwordProtected: false,
      passwordHash: undefined,
      passwordHint: undefined,
    });
    Object.assign(set, { passwordProtected: false });
  } else if (input.password) {
    if (!hasFeature(entitlements, "passwords")) return featureGate("passwords");
    const hash = await bcrypt.hash(input.password, 10);
    const hint = input.passwordHint?.trim().slice(0, 100) || undefined;
    Object.assign(legacy, {
      passwordProtected: true,
      passwordHash: hash,
      passwordHint: hint,
    });
    Object.assign(set, {
      passwordProtected: true,
      passwordHash: hash,
      passwordHint: hint,
    });
  } else if (input.passwordHint !== undefined && link.passwordProtected) {
    if (!hasFeature(entitlements, "passwords")) return featureGate("passwords");
    legacy.passwordHint = input.passwordHint?.trim().slice(0, 100) || undefined;
    set.passwordHint = legacy.passwordHint;
  }

  const derived = withDerived(legacy);
  const $set: Document = { ...derived.$set, updatedAt: nowOf(ctx) };
  const $unset: Document = { ...derived.$unset };
  for (const [field, value] of Object.entries(set)) {
    if (value === undefined) $unset[field] = "";
    else $set[field] = value;
  }
  // Same alias rule as M3: the old key keeps resolving after a rename.
  const update: Document = {
    $set,
    $inc: { "_sync.rev": 1 },
    ...(Object.keys($unset).length ? { $unset } : {}),
    ...(newKey && oldKey ? { $addToSet: { previousKeys: oldKey } } : {}),
  };
  try {
    await collection(ctx.db, "links").updateOne({ _id: link._id }, update);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("key_taken", { key: newKey ?? null });
    throw error;
  }
  if (newKey && oldKey && (!link.domain || link.domain === ctx.linkDomain))
    await renameLegacyClicks(ctx, oldKey, newKey);
  await invalidateLinks(
    ctx.cache,
    link.domain ?? ctx.linkDomain,
    [oldKey, newKey].filter((k): k is string => Boolean(k)),
  );
  const updated = await collection(ctx.db, "links").findOne({ _id: link._id });
  if (!updated) return fail("not_found");
  return ok(toLinkView(updated, ctx.linkDomain));
}

// Legacy's dashboard reads clicks by urlCode; it rewrites them on rename.
async function renameLegacyClicks(
  ctx: ServiceContext,
  from: string,
  to: string,
) {
  const sub = legacySubOf(ctx);
  if (!sub) return;
  await ctx.db
    .collection(physicalNames.clicks)
    .updateMany(
      { type: "click", urlCode: from, sub },
      { $set: { urlCode: to } },
    );
}

export async function deleteLinks(
  ctx: ServiceContext,
  ids: string[],
): Promise<Result<{ deleted: string[] }, LinkError>> {
  const objectIds = ids.flatMap((id) => parseObjectId(id) ?? []);
  const links = await collection(ctx.db, "links")
    .find({ $and: [{ _id: { $in: objectIds } }, ownedBy<Link>(ctx.workspace)] })
    .toArray();
  if (links.some((link) => !can(ctx.actor, "resource.delete", link)))
    return fail("forbidden");
  const deleted: string[] = [];
  for (const link of links) {
    await deleteOne(ctx, link);
    deleted.push(link._id.toHexString());
  }
  return ok({ deleted });
}

// Mirrors legacy deleteShortn: detach the QR, drop the link from campaigns
// (deleting campaigns it empties) and bio pages. Click history stays in
// click_events; legacy `clicks` are archived like legacy's click-archive.
async function deleteOne(ctx: ServiceContext, link: Link) {
  const key = link.urlCode ?? link.key;
  const sub = legacySubOf(ctx);
  if (key && sub)
    await archiveLegacyClicks(
      ctx.db,
      { sub, urlCode: key, type: "click" },
      nowOf(ctx),
    );
  await collection(ctx.db, "links").deleteOne({ _id: link._id });
  const invalidate = [key, ...(link.previousKeys ?? [])].filter(
    (k): k is string => Boolean(k),
  );
  if (link.qrCodeId) {
    const qr = await collection(ctx.db, "qr_codes").findOneAndUpdate(
      {
        $and: [
          { qrCodeId: link.qrCodeId },
          ownedBy<Documents["qr_codes"]>(ctx.workspace),
        ],
      },
      { $set: { attachedUrl: "" }, $unset: { attachedLinkId: "" } },
    );
    if (qr?.urlId) invalidate.push(qr.urlId);
  }
  const campaigns = ctx.db.collection<{ links: ObjectId[] }>(
    physicalNames.campaigns,
  );
  const affected = await campaigns
    .find({ links: link._id }, { projection: { _id: 1 } })
    .toArray();
  if (affected.length) {
    await campaigns.updateMany(
      { links: link._id },
      { $pull: { links: link._id } },
    );
    await campaigns.deleteMany({
      _id: { $in: affected.map((c) => c._id) },
      links: { $size: 0 },
    });
  }
  await ctx.db
    .collection<{ links: { link: ObjectId }[] }>(physicalNames.bio_pages)
    .updateMany(
      { "links.link": link._id },
      { $pull: { links: { link: link._id } } },
    );
  await invalidateLinks(ctx.cache, ctx.linkDomain, invalidate);
}

export interface ListLinksInput {
  search?: string | undefined;
  tags?: string[] | undefined;
  status?: LinkStatusFilter | undefined;
  createdAfter?: Date | undefined;
  /** Exclusive upper bound. */
  createdBefore?: Date | undefined;
  sort?: LinkSort | undefined;
  // 1-based page number; numbered pages for the explicit list (17).
  page?: number | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
  includeHidden?: boolean | undefined;
}

const statusFilter: Record<LinkStatusFilter, Filter<Link>> = {
  password: { passwordProtected: true },
  interstitial: { requiresInterstitial: true, disabled: { $ne: true } },
  disabled: {
    $or: [
      { disabled: true },
      { safetyStatus: { $in: ["blocked", "malicious"] } },
    ],
  },
};

const sortSpec: Record<LinkSort, Record<string, 1 | -1>> = {
  newest: { date: -1, _id: -1 },
  oldest: { date: 1, _id: 1 },
  clicks: { "clicks.total": -1, _id: -1 },
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Keyset pagination on (date, _id) descending; `date` is set by both apps.
export async function listLinks(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  input: ListLinksInput = {},
) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const and: Filter<Link>[] = [
    ownedBy<Link>(ctx.workspace),
    { isQrCode: { $ne: true } },
    ...(!input.includeHidden ? [{ hidden: { $ne: true } }] : []),
  ];
  const search = input.search?.trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search.slice(0, 200)), "i");
    and.push({
      $or: [{ urlCode: pattern }, { longUrl: pattern }, { title: pattern }],
    });
  }
  if (input.tags?.length) and.push({ "tags.tagName": { $in: input.tags } });
  if (input.status) and.push(statusFilter[input.status]);
  if (input.createdAfter) and.push({ date: { $gte: input.createdAfter } });
  if (input.createdBefore) and.push({ date: { $lt: input.createdBefore } });
  if (input.page !== undefined) {
    const page = Math.max(1, Math.floor(input.page));
    const filter = { $and: and };
    const [total, docs] = await Promise.all([
      collection(ctx.db, "links").countDocuments(filter),
      collection(ctx.db, "links")
        .find(filter)
        .sort(sortSpec[input.sort ?? "newest"])
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);
    return {
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      links: docs.map((doc) => toLinkView(doc, ctx.linkDomain)),
      nextCursor: null,
    };
  }
  // The whole filtered set, counted once on the first page.
  const total = input.cursor
    ? null
    : await collection(ctx.db, "links").countDocuments({ $and: [...and] });
  if (input.cursor) {
    const [time, id] = input.cursor.split("_");
    const objectId = id ? parseObjectId(id) : null;
    const date = new Date(Number(time));
    if (objectId && !Number.isNaN(date.getTime()))
      and.push({
        $or: [{ date: { $lt: date } }, { date, _id: { $lt: objectId } }],
      });
  }
  const docs = await collection(ctx.db, "links")
    .find({ $and: and })
    .sort({ date: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();
  const page = docs.slice(0, limit);
  const last = page.at(-1);
  return {
    total,
    page: null,
    pages: null,
    links: page.map((doc) => toLinkView(doc, ctx.linkDomain)),
    nextCursor:
      docs.length > limit && last
        ? `${(last.date ?? last._id.getTimestamp()).getTime()}_${last._id.toHexString()}`
        : null,
  };
}

// Persists a scan the way legacy scanAndPersist does: never downgrades a
// link blocked by moderation, and only ever disables, never re-enables.
export async function scanAndPersistLink(
  ctx: Pick<ServiceContext, "db" | "cache" | "linkDomain">,
  linkId: ObjectId,
  deps: ScanDeps = {},
) {
  const link = await collection(ctx.db, "links").findOne({ _id: linkId });
  if (!link?.longUrl) return;
  const links = ctx.db.collection(physicalNames.links);
  const outcome = await scanUrl(link.longUrl, deps);
  const legacy: Document = {
    ...link,
    riskScore: outcome.riskScore,
    safetyStatus:
      link.safetyStatus === "blocked" ? "blocked" : outcome.safetyStatus,
    scanProvider: outcome.scanProvider,
    lastScannedAt: new Date(),
    ...(outcome.disabled && !link.disabled
      ? {
          disabled: true,
          flagged: true,
          disabledReason: outcome.disabledReason,
        }
      : {}),
  };
  const derived = withDerived(legacy);
  await links.updateOne(
    { _id: linkId, longUrl: link.longUrl },
    {
      $set: {
        ...derived.$set,
        riskScore: legacy.riskScore,
        safetyStatus: legacy.safetyStatus,
        scanProvider: legacy.scanProvider,
        lastScannedAt: legacy.lastScannedAt,
        disabled: Boolean(legacy.disabled),
        flagged: Boolean(legacy.flagged),
        ...(legacy.disabledReason
          ? { disabledReason: legacy.disabledReason }
          : {}),
      },
      $inc: { "_sync.rev": 1 },
    },
  );
  const key = link.urlCode ?? link.key;
  if (key) await invalidateLinks(ctx.cache, ctx.linkDomain, [key]);
}
