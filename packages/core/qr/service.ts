import { validQrCaption } from "@shortn/qr-render/treatment-layout";
import { requestHealthCheck } from "../links/health";
import { requestSafetyScan } from "../links/safety-jobs";
import { hasFeature, loadEntitlements } from "@shortn/billing";
import {
  collection,
  deriveLink,
  physicalNames,
  type Documents,
} from "@shortn/db";
import { invalidateLinks } from "@shortn/redis";
import { customAlphabet } from "nanoid";
import {
  ObjectId,
  type Document,
  type Filter,
  type ClientSession,
} from "mongodb";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import {
  withMutation,
  recordWebhookEvent,
  linkEventData,
} from "../webhooks/events";
import { archiveLegacyClicks } from "../legacy-clicks";
import { fail, ok, type Result } from "../result";
import { validateDestination } from "../safety/structural";
import { embeddedTags, ensureTags, tagName } from "../tags/service";
import { countUsage } from "../usage/service";
import { withQuotaMutation } from "../usage/quota-lock";
import { reservedImportUsage } from "../imports/quota";
import { can } from "../workspaces/authz";
import { legacySubOf, nowOf, type ServiceContext } from "../workspaces/context";
import { ownedBy, parseObjectId } from "../workspaces/service";

type QrCode = Documents["qr_codes"];
type Link = Documents["links"];

const code = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-",
  6,
);

// qr-code-styling options, the format legacy stores and renders. The new
// editor writes the same shape so both dashboards show the same code.
const qrColor = z.string().max(32);
const qrStyle = z.object({
  color: qrColor.optional(),
  type: z.string().max(32).optional(),
});
export const qrDesignSchema = z.object({
  width: z.number().int().min(64).max(4096).optional(),
  height: z.number().int().min(64).max(4096).optional(),
  type: z.enum(["svg", "canvas"]).optional(),
  shape: z.enum(["square", "circle"]).optional(),
  frameOptions: z
    .object({
      style: z.enum(["none", "outline", "solid"]).optional(),
      caption: z.string().max(64).refine(validQrCaption).optional(),
    })
    .optional(),
  data: z.string().max(2048).optional(),
  image: z.string().max(2048).optional(),
  margin: z.number().int().min(0).max(100).optional(),
  dotsOptions: qrStyle.optional(),
  backgroundOptions: z.object({ color: qrColor.optional() }).optional(),
  cornersSquareOptions: qrStyle.optional(),
  cornersDotOptions: qrStyle.optional(),
  imageOptions: z
    .object({
      crossOrigin: z.string().max(32).optional(),
      margin: z.number().int().min(0).max(50).optional(),
      hideBackgroundDots: z.boolean().optional(),
      imageSize: z.number().min(0).max(1).optional(),
    })
    .optional(),
  qrOptions: z
    .object({ errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).optional() })
    .optional(),
});
export type QrDesign = z.infer<typeof qrDesignSchema>;

export const defaultQrDesign = (data: string): QrDesign => ({
  width: 300,
  height: 300,
  type: "svg",
  data,
  dotsOptions: { color: "#1e90ff", type: "square" },
  backgroundOptions: { color: "#ffffff" },
  image: "",
  imageOptions: { crossOrigin: "anonymous", margin: 5 },
});

export interface QrView {
  id: string;
  publicId: string;
  key: string;
  shortUrl: string;
  url: string;
  title: string;
  tags: { id: string; name: string }[];
  scans: number;
  lastScanAt: string | null;
  design: QrDesign;
  // Everything stored, including options the schema doesn't model (legacy
  // gradients), so previews and downloads render the code as printed.
  storedDesign: Record<string, unknown>;
  attachedLinkKey: string | null;
  createdAt: string;
  createdBy: string | null;
}

// Legacy options can hold values this schema doesn't model (gradients,
// string sizes). Each field is read on its own so one odd value never blanks
// the whole design in the editor.
function designOf(qr: QrCode): QrDesign {
  const stored: unknown = qr.options ?? qr.design;
  if (!stored || typeof stored !== "object") return {};
  const design: Record<string, unknown> = {};
  for (const [field, schema] of Object.entries(qrDesignSchema.shape)) {
    const parsed = schema.safeParse(Reflect.get(stored, field));
    if (parsed.success && parsed.data !== undefined)
      design[field] = parsed.data;
  }
  return qrDesignSchema.parse(design);
}

const storedOptions = (qr: QrCode): Record<string, unknown> => {
  const stored: unknown = qr.options ?? qr.design;
  return stored && typeof stored === "object" ? { ...stored } : {};
};

const qrDomain = (qr: QrCode, fallback: string) =>
  typeof qr.domain === "string" && qr.domain ? qr.domain : fallback;
export function toQrView(qr: QrCode, linkDomain: string): QrView {
  const key = qr.urlId ?? "";
  return {
    id: qr._id.toHexString(),
    publicId: qr.qrCodeId ?? qr.publicId ?? "",
    key,
    shortUrl: `https://${qrDomain(qr, linkDomain)}/${key}`,
    url: qr.longUrl ?? "",
    title: qr.title ?? "",
    tags: (qr.tags ?? []).flatMap((tag) => {
      const name = tagName(tag);
      return name ? [{ id: tag.id ?? name, name }] : [];
    }),
    scans: qr.clicks?.total ?? qr.stats?.scans ?? 0,
    lastScanAt: qr.clicks?.lastClick?.toISOString() ?? null,
    design: designOf(qr),
    storedDesign: storedOptions(qr),
    attachedLinkKey:
      typeof qr.attachedUrl === "string" && qr.attachedUrl
        ? qr.attachedUrl
        : null,
    createdAt: (qr.createdAt ?? qr.date ?? qr._id.getTimestamp()).toISOString(),
    createdBy: typeof qr.createdBy === "string" ? qr.createdBy : null,
  };
}

export type QrError =
  | "invalid_input"
  | "forbidden"
  | "invalid_url"
  | "unsafe_destination"
  | "feature_required"
  | "limit_reached"
  | "not_found"
  | "taken_down";

function checkUrl(input: string) {
  const trimmed = input.trim();
  const url = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const structural = validateDestination(url);
  if (!structural.ok)
    return structural.reason === "invalid-url" ||
      structural.reason === "invalid-protocol"
      ? fail("invalid_url")
      : fail("unsafe_destination", { reason: structural.reason ?? null });
  return ok(url);
}

async function freeCode(ctx: ServiceContext, field: "urlCode" | "qrCodeId") {
  const target =
    field === "urlCode" ? physicalNames.links : physicalNames.qr_codes;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = code();
    const clash = await ctx.db
      .collection(target)
      .findOne({ [field]: candidate }, { projection: { _id: 1 } });
    if (!clash) return candidate;
  }
  throw new Error("Could not generate a free QR code");
}

// The logo is a Pro feature (product copy: "Custom logo integration").
function sanitizeDesign(
  design: QrDesign | undefined,
  data: string,
  logoAllowed: boolean,
): QrDesign {
  const merged: QrDesign = {
    ...defaultQrDesign(data),
    ...(design ?? {}),
    data,
  };
  if (!logoAllowed) merged.image = "";
  return merged;
}

export interface CreateQrInput {
  url: string;
  title?: string | undefined;
  tags?: string[] | undefined;
  design?: QrDesign | undefined;
  attachToLinkId?: string | undefined;
}

// Mirrors legacy createQrCode: a hidden backing link (isQrCode) carries the
// redirect, and the QR document points at it through urlId.
export async function createQr(
  ctx: ServiceContext,
  input: CreateQrInput,
): Promise<Result<QrView, QrError>> {
  if (!can(ctx.actor, "resource.create")) return fail("forbidden");
  if (
    input.design &&
    !qrDesignSchema
      .pick({ shape: true, frameOptions: true })
      .safeParse(input.design).success
  )
    return fail("invalid_input");
  const checked = checkUrl(input.url);
  if (!checked.ok) return checked;
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace);
  if (input.design?.image && !hasFeature(entitlements, "qrLogo"))
    return fail("feature_required", { feature: "qrLogo" });
  const attach = input.attachToLinkId
    ? parseObjectId(input.attachToLinkId)
    : null;
  const attachedLink = attach
    ? await collection(ctx.db, "links").findOne({
        $and: [
          { _id: attach, deletedAt: { $exists: false } },
          ownedBy<Link>(ctx.workspace),
        ],
      })
    : null;
  if (input.attachToLinkId && !attachedLink) return fail("not_found");

  const now = nowOf(ctx);
  const sub = legacySubOf(ctx);
  const url = checked.value;
  const urlCode = await freeCode(ctx, "urlCode");
  const qrCodeId = await freeCode(ctx, "qrCodeId");
  const title = input.title?.trim() || `${new URL(url).hostname} - untitled`;
  const tags = await ensureTags(ctx, input.tags ?? []);

  const backing: Document = {
    _id: new ObjectId(),
    ...(sub ? { sub } : {}),
    domain: ctx.linkDomain,
    urlCode,
    customCode: false,
    longUrl: url,
    qrCodeId,
    isQrCode: true,
    title,
    date: now,
    tags: [],
    utmLinks: [],
    clicks: { total: 0, lastClick: null },
    passwordProtected: false,
    riskScore: 0,
    safetyStatus: "pending",
    flagged: false,
    disabled: false,
    reportCount: 0,
    lastScannedAt: null,
    requiresInterstitial: false,
  };
  const derived = deriveLink(backing);
  const fields: Document = {};
  for (const [field, value] of Object.entries(derived.set))
    if (!field.startsWith("_sync.")) fields[field] = value;
  const backingDoc: Document = {
    ...backing,
    safetyScan: requestSafetyScan(now),
    health: requestHealthCheck(url, undefined, now),
    ...fields,
    workspaceId: ctx.workspace._id,
    previousKeys: [],
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.actor.userId,
    _sync: { rev: 1, lastWriter: "v2", legacyHash: derived.legacyHash },
  };

  const design = sanitizeDesign(
    input.design,
    `https://${ctx.linkDomain}/${urlCode}`,
    hasFeature(entitlements, "qrLogo"),
  );
  const qrId = new ObjectId();
  const qrDoc = {
    _id: qrId,
    ...(sub ? { sub } : {}),
    urlId: urlCode,
    attachedUrl: attachedLink?.urlCode ?? "",
    qrCodeId,
    longUrl: url,
    title,
    date: now,
    tags: embeddedTags(tags, sub),
    options: design,
    clicks: { total: 0, lastClick: null },
    workspaceId: ctx.workspace._id,
    linkId: backing._id,
    publicId: qrCodeId,
    design,
    tagIds: tags.map((tag) => tag._id),
    ...(attachedLink ? { attachedLinkId: attachedLink._id } : {}),
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.actor.userId,
  };
  let attachedInvalidation: { keys: string[]; domain: string } | undefined;
  const result = await withQuotaMutation(ctx, async (session) => {
    attachedInvalidation = undefined;
    const limit = entitlements.limits.qrCodes;
    if (limit !== null) {
      const usage = await countUsage(
        ctx.db,
        ctx.workspace,
        entitlements.period,
        session,
      );
      const reserved = await reservedImportUsage(
        ctx.db,
        ctx.workspace._id,
        entitlements.period,
        now,
        session,
      );
      if (usage.qrCodes + reserved.qrCodes >= limit)
        return fail("limit_reached" as const, {
          limit,
          used: usage.qrCodes,
          reserved: reserved.qrCodes,
        });
    }
    const currentAttached = attachedLink
      ? await collection(ctx.db, "links").findOne(
          {
            $and: [
              { _id: attachedLink._id, deletedAt: { $exists: false } },
              ownedBy<Link>(ctx.workspace),
            ],
          },
          { session },
        )
      : null;
    if (attachedLink && !currentAttached) return fail("not_found" as const);
    await ctx.db
      .collection(physicalNames.links)
      .insertOne(backingDoc, { session });
    await ctx.db
      .collection(physicalNames.qr_codes)
      .insertOne(
        { ...qrDoc, attachedUrl: currentAttached?.urlCode ?? "" },
        { session },
      );
    const createdBacking = await collection(ctx.db, "links").findOne(
      { _id: backingDoc._id },
      { session },
    );
    if (!createdBacking) throw new Error("Created QR backing vanished");
    await recordWebhookEvent(
      ctx.db,
      ctx.workspace._id,
      "link.created",
      linkEventData(createdBacking, ctx.linkDomain),
      session,
      now,
    );
    if (currentAttached) {
      attachedInvalidation = {
        keys: [
          currentAttached.key ?? currentAttached.urlCode ?? "",
          ...(currentAttached.previousKeys ?? []),
        ],
        domain: currentAttached.domain ?? ctx.linkDomain,
      };
      const updatedAttached = await collection(
        ctx.db,
        "links",
      ).findOneAndUpdate(
        { _id: currentAttached._id },
        { $set: { qrCodeId, attachedQrId: qrId, updatedAt: now } },
        { session, returnDocument: "after" },
      );
      if (updatedAttached)
        await recordWebhookEvent(
          ctx.db,
          ctx.workspace._id,
          "link.updated",
          linkEventData(updatedAttached, ctx.linkDomain),
          session,
          now,
        );
    }
    const created = await collection(ctx.db, "qr_codes").findOne(
      { _id: qrId },
      { session },
    );
    if (!created) throw new Error("Created QR vanished");
    return ok(toQrView(created, ctx.linkDomain));
  });
  if (!result.ok) return result;

  await invalidateLinks(
    ctx.cache,
    ctx.linkDomain,
    [urlCode, attachedLink?.urlCode].filter((k): k is string => Boolean(k)),
  );
  if (attachedInvalidation)
    await invalidateLinks(
      ctx.cache,
      attachedInvalidation.domain,
      attachedInvalidation.keys,
    );
  return result;
}

async function findOwned(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const _id = parseObjectId(id);
  if (!_id) return null;
  return collection(ctx.db, "qr_codes").findOne({
    $and: [{ _id }, ownedBy<QrCode>(ctx.workspace)],
  });
}

export async function getQr(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  id: string,
) {
  const qr = await findOwned(ctx, id);
  return qr ? toQrView(qr, ctx.linkDomain) : null;
}

export async function listQrs(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  input: { search?: string | undefined } = {},
) {
  const search = input.search?.trim();
  const pattern = search
    ? new RegExp(
        search.slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      )
    : null;
  const docs = await collection(ctx.db, "qr_codes")
    .find({
      $and: [
        ownedBy<QrCode>(ctx.workspace),
        ...(pattern
          ? [
              {
                $or: [
                  { title: pattern },
                  { longUrl: pattern },
                  { qrCodeId: pattern },
                ],
              },
            ]
          : []),
      ],
    })
    .sort({ date: -1, _id: -1 })
    .limit(500)
    .toArray();
  return docs.map((doc) => toQrView(doc, ctx.linkDomain));
}

// Option groups (dotsOptions, …) merge one level deep, so changing a dot
// colour keeps a legacy gradient stored in the same group.
function mergeDesign(stored: Record<string, unknown>, edit: QrDesign) {
  const merged: Record<string, unknown> = { ...stored };
  for (const [key, value] of Object.entries(edit)) {
    const before = stored[key];
    merged[key] =
      value &&
      typeof value === "object" &&
      before &&
      typeof before === "object" &&
      !Array.isArray(before)
        ? { ...before, ...value }
        : value;
  }
  return merged;
}

// Numbered pages for the QR list (17), alongside the unpaged listQrs.
interface QrLibraryInput {
  ids?: string[] | undefined;
  search?: string | undefined;
  tag?: string | undefined;
  tags?: string[] | undefined;
  createdAfter?: Date | undefined;
  createdBefore?: Date | undefined;
}

function qrLibraryFilter(
  ctx: Pick<ServiceContext, "workspace">,
  input: QrLibraryInput,
): Filter<QrCode> {
  if (
    input.ids &&
    (input.ids.length > 500 || input.ids.some((id) => !parseObjectId(id)))
  )
    throw new Error("invalid_selection");
  const search = input.search?.trim();
  const tags = [...new Set(input.tags ?? (input.tag ? [input.tag] : []))].slice(
    0,
    50,
  );
  const pattern = search
    ? new RegExp(
        search.slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      )
    : null;
  return {
    $and: [
      ownedBy<QrCode>(ctx.workspace),
      ...(input.ids
        ? [{ _id: { $in: input.ids.map((id) => new ObjectId(id)) } }]
        : []),
      ...(pattern
        ? [
            {
              $or: [
                { title: pattern },
                { longUrl: pattern },
                { qrCodeId: pattern },
              ],
            },
          ]
        : []),
      ...(tags.length ? [{ "tags.tagName": { $in: tags } }] : []),
      ...(input.createdAfter ? [{ date: { $gte: input.createdAfter } }] : []),
      ...(input.createdBefore ? [{ date: { $lt: input.createdBefore } }] : []),
    ],
  };
}

export async function cursorQrs(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  input: QrLibraryInput & {
    cursor?: string | undefined;
    limit?: number | undefined;
  } = {},
) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const filter = qrLibraryFilter(ctx, input);
  const total = input.cursor
    ? null
    : await collection(ctx.db, "qr_codes").countDocuments(filter);
  const cursor = input.cursor ? parseObjectId(input.cursor) : null;
  const docs = await collection(ctx.db, "qr_codes")
    .find(cursor ? { $and: [filter, { _id: { $lt: cursor } }] } : filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();
  const page = docs.slice(0, limit);
  return {
    items: page.map((doc) => toQrView(doc, ctx.linkDomain)),
    total,
    nextCursor: docs.length > limit ? page.at(-1)!._id.toHexString() : null,
  };
}

export async function pageQrs(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  input: {
    ids?: string[] | undefined;
    search?: string | undefined;
    tag?: string | undefined;
    tags?: string[] | undefined;
    createdAfter?: Date | undefined;
    /** Exclusive upper bound. */
    createdBefore?: Date | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  } = {},
) {
  const limit = Math.min(Math.max(input.limit ?? 24, 1), 100);
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const filter = qrLibraryFilter(ctx, input);
  const [total, docs] = await Promise.all([
    collection(ctx.db, "qr_codes").countDocuments(filter),
    collection(ctx.db, "qr_codes")
      .find(filter)
      .sort({ date: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
  ]);
  return {
    items: docs.map((doc) => toQrView(doc, ctx.linkDomain)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function countSelectedQrs(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  ids: string[],
) {
  return collection(ctx.db, "qr_codes").countDocuments(
    qrLibraryFilter(ctx, { ids }),
  );
}

export interface UpdateQrInput {
  url?: string | undefined;
  title?: string | undefined;
  tags?: string[] | undefined;
  design?: QrDesign | undefined;
  applyToLink?: boolean | undefined;
}

// Legacy updateQRCodeData + updateQRCodeOptions: destination and title move
// with the backing link; `applyToLink` copies them to the attached link.
export async function updateQr(
  ctx: ServiceContext,
  id: string,
  input: UpdateQrInput,
): Promise<Result<QrView, QrError>> {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden");
  if (
    input.design &&
    !qrDesignSchema
      .pick({ shape: true, frameOptions: true })
      .safeParse(input.design).success
  )
    return fail("invalid_input");
  const qr = await findOwned(ctx, id);
  if (!qr) return fail("not_found");
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace);
  const $set: Document = { updatedAt: nowOf(ctx) };
  const linkSet: Document = {};
  if (input.url !== undefined) {
    const checked = checkUrl(input.url);
    if (!checked.ok) return checked;
    $set.longUrl = checked.value;
    linkSet.longUrl = checked.value;
  }
  if (input.title !== undefined) {
    $set.title = input.title.trim();
    linkSet.title = $set.title;
  }
  if (input.tags !== undefined) {
    const tags = await ensureTags(ctx, input.tags);
    $set.tags = embeddedTags(tags, legacySubOf(ctx));
    $set.tagIds = tags.map((tag) => tag._id);
  }
  if (input.design?.image && !hasFeature(entitlements, "qrLogo"))
    return fail("feature_required", { feature: "qrLogo" });
  if (Object.keys(linkSet).length) {
    const targets = [
      qr.linkId instanceof ObjectId
        ? { _id: qr.linkId }
        : typeof qr.urlId === "string" && qr.urlId
          ? { urlCode: qr.urlId }
          : null,
      input.applyToLink && qr.attachedLinkId instanceof ObjectId
        ? { _id: qr.attachedLinkId }
        : null,
    ].filter((target) => target !== null);
    if (
      targets.length &&
      (await collection(ctx.db, "links").findOne(
        {
          $and: [
            { $or: targets },
            { moderation: { $exists: true } },
            ownedBy<Link>(ctx.workspace),
          ],
        },
        { projection: { _id: 1 } },
      ))
    )
      return fail("taken_down");
  }
  const result = await withMutation(ctx.db, async (session) => {
    const current = await collection(ctx.db, "qr_codes").findOne(
      { $and: [{ _id: qr._id }, ownedBy<QrCode>(ctx.workspace)] },
      { session },
    );
    if (!current) return null;
    const changes = { ...$set };
    if (input.design) {
      const design = {
        ...mergeDesign(storedOptions(current), input.design),
        data: `https://${qrDomain(current, ctx.linkDomain)}/${current.urlId ?? ""}`,
      };
      changes.options = design;
      changes.design = design;
    }
    await ctx.db
      .collection(physicalNames.qr_codes)
      .updateOne({ _id: current._id }, { $set: changes }, { session });
    const changedLinks: Link[] = [];
    if (Object.keys(linkSet).length && current.urlId) {
      const backing = await updateBackingLink(
        ctx,
        current.urlId,
        linkSet,
        session,
        current.linkId,
      );
      if (backing) changedLinks.push(backing);
    }
    if (
      input.applyToLink &&
      (current.attachedLinkId instanceof ObjectId ||
        (typeof current.attachedUrl === "string" && current.attachedUrl))
    ) {
      const attachedSet: Document = { ...linkSet };
      if (changes.tags) attachedSet.tags = changes.tags;
      if (changes.tagIds) attachedSet.tagIds = changes.tagIds;
      const attached = await updateBackingLink(
        ctx,
        typeof current.attachedUrl === "string" ? current.attachedUrl : "",
        attachedSet,
        session,
        current.attachedLinkId instanceof ObjectId
          ? current.attachedLinkId
          : undefined,
      );
      if (attached) changedLinks.push(attached);
    }
    const updated = await collection(ctx.db, "qr_codes").findOne(
      { _id: current._id },
      { session },
    );
    return updated ? { updated, changedLinks } : null;
  });
  if (!result) return fail("not_found");
  await invalidateLinks(
    ctx.cache,
    qrDomain(result.updated, ctx.linkDomain),
    [result.updated.urlId].filter((key): key is string => Boolean(key)),
  );
  for (const link of result.changedLinks)
    await invalidateLinks(ctx.cache, link.domain ?? ctx.linkDomain, [
      link.key ?? link.urlCode ?? "",
      ...(link.previousKeys ?? []),
    ]);
  return ok(toQrView(result.updated, ctx.linkDomain));
}

async function updateBackingLink(
  ctx: ServiceContext,
  urlCode: string,
  changes: Document,
  session: ClientSession,
  linkId?: ObjectId,
) {
  const defined = Object.fromEntries(
    Object.entries(changes).filter(([, v]) => v !== undefined),
  );
  if (!Object.keys(defined).length) return null;
  const links = collection(ctx.db, "links");
  const link = await links.findOne(
    {
      $and: [
        {
          ...(linkId ? { _id: linkId } : { urlCode }),
          deletedAt: { $exists: false },
        },
        ownedBy<Link>(ctx.workspace),
      ],
    },
    { session },
  );
  if (
    !link ||
    link.moderation ||
    Object.entries(defined).every(([key, value]) =>
      isDeepStrictEqual(link[key], value),
    )
  )
    return null;
  if (defined.longUrl !== undefined && defined.longUrl !== link.longUrl) {
    defined.safetyScan = requestSafetyScan(nowOf(ctx));
    defined.health = requestHealthCheck(
      String(defined.longUrl),
      link.rules,
      nowOf(ctx),
    );
    defined.safetyStatus =
      link.safetyStatus === "blocked" ? "blocked" : "pending";
  }
  const merged = { ...link, ...defined };
  const derived = deriveLink(merged);
  const fields: Document = {};
  for (const [field, value] of Object.entries(derived.set))
    if (!field.startsWith("_sync.")) fields[field] = value;
  const mutation: Document = {
    $set: {
      ...defined,
      ...fields,
      "_sync.legacyHash": derived.legacyHash,
      "_sync.lastWriter": "v2",
      updatedAt: nowOf(ctx),
    },
    $inc: { "_sync.rev": 1 },
  };
  const updated = await links.findOneAndUpdate(
    { _id: link._id, deletedAt: { $exists: false } },
    mutation,
    { session, returnDocument: "after" },
  );
  if (updated)
    await recordWebhookEvent(
      ctx.db,
      ctx.workspace._id,
      "link.updated",
      linkEventData(updated, ctx.linkDomain),
      session,
      nowOf(ctx),
    );
  return updated;
}

// Mirrors legacy deleteQRCode: archive scans, delete the QR and its backing
// link, and detach the link it was attached to.
export async function deleteQrs(
  ctx: ServiceContext,
  ids: string[],
): Promise<Result<{ deleted: string[] }, QrError>> {
  const objectIds = ids.flatMap((id) => parseObjectId(id) ?? []);
  const qrs = await collection(ctx.db, "qr_codes")
    .find({
      $and: [{ _id: { $in: objectIds } }, ownedBy<QrCode>(ctx.workspace)],
    })
    .toArray();
  if (
    qrs.some(
      (qr) =>
        !can(ctx.actor, "resource.delete", {
          createdBy:
            typeof qr.createdBy === "string" ? qr.createdBy : undefined,
        }),
    )
  )
    return fail("forbidden");
  const sub = legacySubOf(ctx);
  const deleted: string[] = [];
  for (const qr of qrs) {
    const removed = await withMutation(ctx.db, async (session) => {
      const current = await collection(ctx.db, "qr_codes").findOne(
        { $and: [{ _id: qr._id }, ownedBy<QrCode>(ctx.workspace)] },
        { session },
      );
      if (!current) return null;
      const now = nowOf(ctx);
      if (sub && current.qrCodeId)
        await archiveLegacyClicks(
          ctx.db,
          {
            sub,
            urlCode: current.qrCodeId,
            type: "scan",
            workspaceId: ctx.workspace._id,
          },
          now,
          session,
        );
      await ctx.db
        .collection(physicalNames.qr_codes)
        .deleteOne({ _id: current._id }, { session });
      const changedLinks: Link[] = [];
      const backing = current.urlId
        ? await collection(ctx.db, "links").findOneAndDelete(
            {
              $and: [
                {
                  ...(current.linkId
                    ? { _id: current.linkId }
                    : { urlCode: current.urlId }),
                  isQrCode: true,
                },
                ownedBy<Link>(ctx.workspace),
              ],
            },
            { session },
          )
        : null;
      if (backing) {
        changedLinks.push(backing);
        await recordWebhookEvent(
          ctx.db,
          ctx.workspace._id,
          "link.deleted",
          linkEventData({ ...backing, deletedAt: now }, ctx.linkDomain),
          session,
          now,
        );
      }
      if (
        current.qrCodeId &&
        (current.attachedLinkId instanceof ObjectId ||
          (typeof current.attachedUrl === "string" && current.attachedUrl))
      ) {
        const attached = await collection(ctx.db, "links").findOneAndUpdate(
          {
            $and: [
              {
                ...(current.attachedLinkId instanceof ObjectId
                  ? { _id: current.attachedLinkId }
                  : {
                      urlCode:
                        typeof current.attachedUrl === "string"
                          ? current.attachedUrl
                          : "",
                    }),
                qrCodeId: current.qrCodeId,
                isQrCode: { $ne: true },
              },
              ownedBy<Link>(ctx.workspace),
            ],
          },
          {
            $set: { qrCodeId: "", updatedAt: now },
            $unset: { attachedQrId: "" },
          },
          { session, returnDocument: "after" },
        );
        if (attached) {
          changedLinks.push(attached);
          await recordWebhookEvent(
            ctx.db,
            ctx.workspace._id,
            "link.updated",
            linkEventData(attached, ctx.linkDomain),
            session,
            now,
          );
        }
      }
      return { current, changedLinks };
    });
    if (!removed) continue;
    await invalidateLinks(
      ctx.cache,
      qrDomain(removed.current, ctx.linkDomain),
      [removed.current.urlId, removed.current.attachedUrl].filter(
        (key): key is string => typeof key === "string" && Boolean(key),
      ),
    );
    for (const link of removed.changedLinks)
      await invalidateLinks(ctx.cache, link.domain ?? ctx.linkDomain, [
        link.key ?? link.urlCode ?? "",
        ...(link.previousKeys ?? []),
      ]);
    deleted.push(qr._id.toHexString());
  }
  return ok({ deleted });
}
