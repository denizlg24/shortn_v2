import { hasFeature, loadEntitlements } from "@shortn/billing";
import {
  collection,
  deriveLink,
  physicalNames,
  type Documents,
} from "@shortn/db";
import { invalidateLinks } from "@shortn/redis";
import { customAlphabet } from "nanoid";
import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { archiveLegacyClicks } from "../legacy-clicks";
import { fail, ok, type Result } from "../result";
import { validateDestination } from "../safety/structural";
import { embeddedTags, ensureTags, tagName } from "../tags/service";
import { countUsage } from "../usage/service";
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

export function toQrView(qr: QrCode, linkDomain: string): QrView {
  const key = qr.urlId ?? "";
  return {
    id: qr._id.toHexString(),
    publicId: qr.qrCodeId ?? qr.publicId ?? "",
    key,
    shortUrl: `https://${linkDomain}/${key}`,
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
  | "forbidden"
  | "invalid_url"
  | "unsafe_destination"
  | "feature_required"
  | "limit_reached"
  | "not_found";

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
  const checked = checkUrl(input.url);
  if (!checked.ok) return checked;
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  if (input.design?.image && !hasFeature(entitlements, "qrLogo"))
    return fail("feature_required", { feature: "qrLogo" });
  const attach = input.attachToLinkId
    ? parseObjectId(input.attachToLinkId)
    : null;
  const attachedLink = attach
    ? await collection(ctx.db, "links").findOne({
        $and: [{ _id: attach }, ownedBy<Link>(ctx.workspace)],
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
  await ctx.db.collection(physicalNames.links).insertOne({
    ...backing,
    ...fields,
    workspaceId: ctx.workspace._id,
    previousKeys: [],
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.actor.userId,
    _sync: { rev: 1, lastWriter: "v2", legacyHash: derived.legacyHash },
  });

  const design = sanitizeDesign(
    input.design,
    `https://${ctx.linkDomain}/${urlCode}`,
    hasFeature(entitlements, "qrLogo"),
  );
  const qrId = new ObjectId();
  await ctx.db.collection(physicalNames.qr_codes).insertOne({
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
  });

  const limit = entitlements.limits.qrCodes;
  if (limit !== null) {
    const usage = await countUsage(ctx.db, ctx.workspace, entitlements.period);
    if (usage.qrCodes > limit) {
      await ctx.db.collection(physicalNames.qr_codes).deleteOne({ _id: qrId });
      await ctx.db
        .collection(physicalNames.links)
        .deleteOne({ _id: backing._id });
      return fail("limit_reached", { limit, used: usage.qrCodes - 1 });
    }
  }
  if (attachedLink)
    await ctx.db
      .collection(physicalNames.links)
      .updateOne(
        { _id: attachedLink._id },
        { $set: { qrCodeId, attachedQrId: qrId } },
      );
  await invalidateLinks(
    ctx.cache,
    ctx.linkDomain,
    [urlCode, attachedLink?.urlCode].filter((k): k is string => Boolean(k)),
  );
  const created = await collection(ctx.db, "qr_codes").findOne({ _id: qrId });
  if (!created) throw new Error("Created QR vanished");
  return ok(toQrView(created, ctx.linkDomain));
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
export async function pageQrs(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  input: {
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
  const filter = {
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
      ...(tags.length ? [{ "tags.tagName": { $in: tags } }] : []),
      ...(input.createdAfter ? [{ date: { $gte: input.createdAfter } }] : []),
      ...(input.createdBefore ? [{ date: { $lt: input.createdBefore } }] : []),
    ],
  };
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
  const qr = await findOwned(ctx, id);
  if (!qr) return fail("not_found");
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const $set: Document = { updatedAt: nowOf(ctx) };
  const linkSet: Document = {};
  if (input.url !== undefined && input.url.trim() !== qr.longUrl) {
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
  if (input.design) {
    if (input.design.image && !hasFeature(entitlements, "qrLogo"))
      return fail("feature_required", { feature: "qrLogo" });
    // Merged onto what is stored, so options the editor doesn't model
    // (legacy gradients) survive an edit.
    const design = {
      ...mergeDesign(storedOptions(qr), input.design),
      data: `https://${ctx.linkDomain}/${qr.urlId ?? ""}`,
    };
    $set.options = design;
    $set.design = design;
  }
  await ctx.db
    .collection(physicalNames.qr_codes)
    .updateOne({ _id: qr._id }, { $set });
  const keys = [qr.urlId];
  if (Object.keys(linkSet).length && qr.urlId) {
    await updateBackingLink(ctx, qr.urlId, { longUrl: linkSet.longUrl });
    if (
      input.applyToLink &&
      typeof qr.attachedUrl === "string" &&
      qr.attachedUrl
    ) {
      const attachedSet: Document = { ...linkSet };
      if ($set.tags) attachedSet.tags = $set.tags;
      await updateBackingLink(ctx, qr.attachedUrl, attachedSet);
      keys.push(qr.attachedUrl);
    }
  }
  await invalidateLinks(
    ctx.cache,
    ctx.linkDomain,
    keys.filter((k): k is string => Boolean(k)),
  );
  const updated = await collection(ctx.db, "qr_codes").findOne({ _id: qr._id });
  if (!updated) return fail("not_found");
  return ok(toQrView(updated, ctx.linkDomain));
}

async function updateBackingLink(
  ctx: ServiceContext,
  urlCode: string,
  changes: Document,
) {
  const defined = Object.fromEntries(
    Object.entries(changes).filter(([, v]) => v !== undefined),
  );
  if (!Object.keys(defined).length) return;
  const links = ctx.db.collection(physicalNames.links);
  const link = await links.findOne({
    $and: [{ urlCode }, ownedBy<Document>(ctx.workspace)],
  });
  if (!link) return;
  const merged = { ...link, ...defined };
  const derived = deriveLink(merged);
  const fields: Document = {};
  for (const [field, value] of Object.entries(derived.set))
    if (!field.startsWith("_sync.")) fields[field] = value;
  await links.updateOne(
    { _id: link._id },
    {
      $set: {
        ...defined,
        ...fields,
        "_sync.legacyHash": derived.legacyHash,
        "_sync.lastWriter": "v2",
        updatedAt: nowOf(ctx),
      },
      $inc: { "_sync.rev": 1 },
    },
  );
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
    if (sub && qr.qrCodeId)
      await archiveLegacyClicks(
        ctx.db,
        { sub, urlCode: qr.qrCodeId, type: "scan" },
        nowOf(ctx),
      );
    await ctx.db.collection(physicalNames.qr_codes).deleteOne({ _id: qr._id });
    const keys: string[] = [];
    if (qr.urlId) {
      await ctx.db.collection(physicalNames.links).deleteOne({
        $and: [
          { urlCode: qr.urlId, isQrCode: true },
          ownedBy<Document>(ctx.workspace),
        ],
      });
      keys.push(qr.urlId);
    }
    if (qr.qrCodeId && typeof qr.attachedUrl === "string" && qr.attachedUrl) {
      await ctx.db.collection(physicalNames.links).updateOne(
        {
          $and: [
            { qrCodeId: qr.qrCodeId, isQrCode: { $ne: true } },
            ownedBy<Document>(ctx.workspace),
          ],
        },
        { $set: { qrCodeId: "" }, $unset: { attachedQrId: "" } },
      );
      keys.push(qr.attachedUrl);
    }
    await invalidateLinks(ctx.cache, ctx.linkDomain, keys);
    deleted.push(qr._id.toHexString());
  }
  return ok({ deleted });
}
