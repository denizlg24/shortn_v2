import { defaultQrDesign } from "../qr/service";
import {
  requestHealthCheck,
  healthSignature,
  linkHealthView,
  type LinkHealthView,
} from "./health";
import {
  socialPreviewSchema,
  readSocialPreview,
  type SocialPreview,
} from "./og";
import { requestRuleSchedule } from "./rule-jobs";
import { requestSafetyScan, type SafetyScanLease } from "./safety-jobs";
import {
  linkRulesInputSchema,
  storedRules,
  rulesView,
  ruleDestinations,
  type LinkRulesInput,
} from "./rules";
import {
  hasFeature,
  loadEntitlements,
  type Feature,
  type Entitlements,
} from "@shortn/billing";
import {
  collection,
  deriveLink,
  physicalNames,
  type Documents,
} from "@shortn/db";
import { invalidateLinks } from "@shortn/redis";
import bcrypt from "bcryptjs";
import { isDeepStrictEqual } from "node:util";
import { customAlphabet } from "nanoid";
import {
  ObjectId,
  type Document,
  type Filter,
  type ClientSession,
} from "mongodb";
import {
  withMutation,
  recordWebhookEvent,
  recordWebhookEvents,
  linkEventData,
} from "../webhooks/events";
import { archiveLegacyClicks } from "../legacy-clicks";
import { fail, ok, type Result } from "../result";
import type { LinkSort, LinkStatusFilter } from "./filters";
import { isReservedKey } from "../routing";
import { scanUrl, type ScanDeps } from "../safety/scan";
import { validateDestination } from "../safety/structural";
import {
  embeddedTags,
  ensureTags,
  tagName,
  normalizeTagName,
} from "../tags/service";
import { countUsage } from "../usage/service";
import { withQuotaMutation } from "../usage/quota-lock";
import {
  reservedImportUsage,
  heldImportBatch,
  finishImportBatch,
  readImportReceipt,
  importBatchHash,
  validImportBatch,
  type ImportBatch,
} from "../imports/quota";
import { can } from "../workspaces/authz";
import { legacySubOf, nowOf, type ServiceContext } from "../workspaces/context";
import { ownedBy, parseObjectId } from "../workspaces/service";
import { isTakenDown } from "./moderation";

type Link = Documents["links"];
type CampaignRefs = { links: ObjectId[]; workspaceId?: ObjectId; sub?: string };
type BioRefs = {
  links: { link: ObjectId }[];
  workspaceId?: ObjectId;
  userId?: string;
};

export const keyPattern = /^[A-Za-z0-9_-]{1,64}$/;
// Same alphabet and length as legacy's nanoid(6).
const generateKey = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-",
  6,
);

export interface LinkView {
  health?: LinkHealthView;
  og?: SocialPreview;
  rules?: LinkRulesInput;
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
  /** Set when Shortn staff took the link down; owners can't edit it. */
  moderation?: { state: "taken_down"; category: string } | null;
  deletedAt?: string | null;
  archivedAt?: string | null;
  restoreUntil?: string | null;
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
  const rules = rulesView(link.rules);
  const og = readSocialPreview(link.og);
  const health = linkHealthView(link);
  return {
    ...(rules ? { rules } : {}),
    ...(og ? { og } : {}),
    ...(health ? { health } : {}),
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
    moderation: link.moderation
      ? { state: link.moderation.state, category: link.moderation.category }
      : null,
    deletedAt: link.deletedAt?.toISOString() ?? null,
    archivedAt: link.archivedAt?.toISOString() ?? null,
    restoreUntil: link.deletedAt
      ? new Date(link.deletedAt.getTime() + linkTrashRetentionMs).toISOString()
      : null,
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
  | "not_found"
  | "invalid_input"
  | "taken_down";

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
  session?: ClientSession,
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
    { projection: { _id: 1 }, ...(session ? { session } : {}) },
  );
  return !clash;
}

async function checkKey(
  ctx: ServiceContext,
  key: string,
  except?: ObjectId,
  domain = ctx.linkDomain,
  skipDatabase = false,
) {
  if (!keyPattern.test(key)) return fail("invalid_key");
  if (isReservedKey(key)) return fail("key_reserved", { key });
  if (!skipDatabase && !(await keyAvailable(ctx, key, except, domain)))
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

/** Advisory only: creation still checks availability atomically. */
export async function suggestAvailableLinkKey(
  ctx: ServiceContext,
  url: string,
  title?: string,
) {
  if (
    !can(ctx.actor, "resource.create") ||
    !hasFeature(await loadEntitlements(ctx.db, ctx.workspace._id), "customKeys")
  )
    return null;
  let source = title?.trim() ?? "";
  if (!source) {
    try {
      const parsed = new URL(url);
      source = decodeURIComponent(
        parsed.pathname.split("/").filter(Boolean).at(-1) ??
          parsed.hostname.replace(/^www\./, "").split(".")[0]!,
      );
    } catch {
      source = "link";
    }
  }
  const base =
    source
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/g, "") || "link";
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt ? `${base}-${generateKey().slice(0, 6)}` : base;
    if ((await checkKey(ctx, candidate)).ok) return candidate;
  }
  return null;
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
  og?: SocialPreview | undefined;
  rules?: LinkRulesInput | undefined;
  domain?: string | undefined;
  url: string;
  key?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  tags?: string[] | undefined;
  password?: string | undefined;
  passwordHint?: string | undefined;
}

interface PreparedLinkCreation {
  input: CreateLinkInput;
  domain: string;
  key: string;
  url: string;
  passwordHash?: string;
}

async function prepareLinkCreation(
  ctx: ServiceContext,
  input: CreateLinkInput,
  entitlements: Entitlements,
  dryRun = false,
  batch = false,
): Promise<Result<PreparedLinkCreation, LinkError>> {
  if (!can(ctx.actor, "resource.create")) return fail("forbidden");
  if (input.rules !== undefined) {
    const parsed = linkRulesInputSchema.safeParse(input.rules);
    if (!parsed.success) return fail("invalid_input", { field: "rules" });
    input = { ...input, rules: parsed.data };
  }
  if (input.og !== undefined) {
    const parsed = socialPreviewSchema.safeParse(input.og);
    if (!parsed.success) return fail("invalid_input", { field: "og" });
    input = { ...input, og: readSocialPreview(parsed.data)! };
  }
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

  let key: string;
  if (input.key?.trim()) {
    if (!hasFeature(entitlements, "customKeys"))
      return featureGate("customKeys");
    const checked = await checkKey(
      ctx,
      input.key.trim(),
      undefined,
      domain,
      batch,
    );
    if (!checked.ok) return checked;
    key = checked.value;
  } else if (dryRun) key = "";
  else if (batch) {
    do {
      key = generateKey();
    } while (isReservedKey(key));
  } else key = await freshKey(ctx, domain);

  if (input.password && !hasFeature(entitlements, "passwords"))
    return featureGate("passwords");

  return ok({
    input,
    domain,
    key,
    url: destination.value,
    ...(input.password && !dryRun
      ? { passwordHash: await bcrypt.hash(input.password, 10) }
      : {}),
  });
}

/** Batched indexed alias checks avoid a database round trip for every imported row. */
async function takenCreationKeys(
  ctx: ServiceContext,
  items: readonly { domain: string; key: string }[],
  session?: ClientSession,
) {
  const groups = new Map<string, Set<string>>(),
    taken = new Set<string>();
  for (const item of items)
    if (item.key) {
      const keys = groups.get(item.domain) ?? new Set<string>();
      keys.add(item.key);
      groups.set(item.domain, keys);
    }
  for (const [domain, keys] of groups) {
    const values = [...keys],
      cursor = collection(ctx.db, "links")
        .find(
          {
            $or: [
              ...(domain === ctx.linkDomain
                ? [{ urlCode: { $in: values }, domain: { $exists: false } }]
                : []),
              { domain, urlCode: { $in: values } },
              { domain, key: { $in: values } },
              { domain, previousKeys: { $in: values } },
            ],
          },
          {
            projection: { urlCode: 1, key: 1, previousKeys: 1 },
            ...(session ? { session } : {}),
          },
        )
        .batchSize(100);
    try {
      for await (const row of cursor)
        for (const key of [row.urlCode, row.key, ...(row.previousKeys ?? [])])
          if (key && keys.has(key)) taken.add(`${domain}/${key}`);
    } finally {
      await cursor.close();
    }
  }
  return taken;
}

/** Same validation as creation, with no generated keys, hashes or writes. */
export async function validateCreateLinks(
  ctx: ServiceContext,
  inputs: readonly CreateLinkInput[],
) {
  if (!inputs.length || inputs.length > 500)
    throw new Error("invalid_batch_size");
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const results: Result<CreateLinkInput, LinkError>[] = [];
  for (const input of inputs) {
    const result = await prepareLinkCreation(
      ctx,
      input,
      entitlements,
      true,
      true,
    );
    results.push(
      result.ok
        ? ok({
            ...result.value.input,
            url: result.value.url,
            domain: result.value.domain,
            ...(result.value.key ? { key: result.value.key } : {}),
          })
        : result,
    );
  }
  const taken = await takenCreationKeys(
    ctx,
    results.flatMap((result) =>
      result.ok && result.value.key
        ? [{ domain: result.value.domain!, key: result.value.key }]
        : [],
    ),
  );
  return results.map((result) =>
    result.ok &&
    result.value.key &&
    taken.has(`${result.value.domain}/${result.value.key}`)
      ? fail("key_taken" as const, { key: result.value.key })
      : result,
  );
}

export async function createLink(
  ctx: ServiceContext,
  input: CreateLinkInput,
): Promise<Result<LinkView, LinkError>> {
  const result = await createMany(ctx, [input]);
  return result.ok ? ok(result.value[0]!) : result;
}

/** All-or-nothing bounded batch shared by REST and imports. */
export async function createMany(
  ctx: ServiceContext,
  inputs: readonly CreateLinkInput[],
  importBatch?: ImportBatch,
): Promise<Result<LinkView[], LinkError>> {
  return createManyAttached(ctx, inputs, undefined, importBatch);
}

class BioAttachmentError extends Error {
  constructor(readonly reason: "not_found" | "limit_reached") {
    super(reason);
  }
}

/** Create and append atomically: failed attachment cannot consume link quota. */
export async function createBioLink(
  ctx: ServiceContext,
  pageId: string,
  input: { url: string; title?: string | undefined },
): Promise<Result<LinkView, LinkError>> {
  if (!can(ctx.actor, "resource.create") || !can(ctx.actor, "resource.update"))
    return fail("forbidden");
  const _id = parseObjectId(pageId);
  if (!_id) return fail("not_found");
  if (input.title && input.title.trim().length > 120)
    return fail("invalid_input");
  try {
    const result = await createManyAttached(
      ctx,
      [input],
      async (links, session) => {
        const pages = collection(ctx.db, "bio_pages");
        const filter = {
          $and: [
            { _id },
            ownedBy<Documents["bio_pages"]>(ctx.workspace, "userId"),
          ],
        };
        if (!(await pages.findOne(filter, { session, projection: { _id: 1 } })))
          throw new BioAttachmentError("not_found");
        const attached = await ctx.db
          .collection(physicalNames.bio_pages)
          .updateOne(
            {
              ...filter,
              $expr: { $lt: [{ $size: { $ifNull: ["$links", []] } }, 100] },
            },
            {
              $push: {
                links: {
                  link: new ObjectId(links[0]!.id),
                  ...(input.title?.trim() ? { title: input.title.trim() } : {}),
                  addedAt: nowOf(ctx),
                },
              },
              $set: { updatedAt: nowOf(ctx) },
            } as Document,
            { session },
          );
        if (!attached.modifiedCount)
          throw new BioAttachmentError("limit_reached");
      },
    );
    return result.ok ? ok(result.value[0]!) : result;
  } catch (error) {
    if (error instanceof BioAttachmentError) return fail(error.reason);
    throw error;
  }
}

interface CreatedImportView extends LinkView {
  importQrId?: string;
}
export interface ImportedQr {
  id: string;
  backingId: string;
  publicId: string;
  key: string;
  domain: string;
}
/** Atomic default-design QR import; uses the same validators and backing writer as links. */
export async function createManyQrImports(
  ctx: ServiceContext,
  inputs: readonly CreateLinkInput[],
  batch: ImportBatch,
): Promise<Result<ImportedQr[], LinkError>> {
  const result = await createManyAttached(ctx, inputs, undefined, batch, true);
  if (!result.ok) return result;
  return ok(
    result.value.map((value) => {
      if (!value.importQrId || !value.qrCodeId)
        throw new Error("QR import receipt is incomplete");
      return {
        id: value.importQrId,
        backingId: value.id,
        publicId: value.qrCodeId,
        key: value.key,
        domain: value.domain,
      };
    }),
  );
}

async function createManyAttached(
  ctx: ServiceContext,
  inputs: readonly CreateLinkInput[],
  attach?: (links: LinkView[], session: ClientSession) => Promise<void>,
  importBatch?: ImportBatch,
  qrImport = false,
): Promise<Result<CreatedImportView[], LinkError>> {
  if (qrImport && !importBatch) return fail("invalid_input");
  const metric = qrImport ? "qrCodes" : "links";
  if (!can(ctx.actor, "resource.create")) return fail("forbidden");
  if (!inputs.length || inputs.length > 1000)
    return fail("invalid_input", { max: 1000, requested: inputs.length });
  if (importBatch && (!validImportBatch(importBatch) || inputs.length > 500))
    return fail("invalid_input");
  const invalidateCreated = async (values: LinkView[]) => {
    const byDomain = new Map<string, string[]>();
    for (const item of values)
      byDomain.set(item.domain, [
        ...(byDomain.get(item.domain) ?? []),
        item.key,
      ]);
    for (const [domain, keys] of byDomain)
      await invalidateLinks(ctx.cache, domain, keys);
  };
  const hash = importBatch
    ? importBatchHash(qrImport ? [{ kind: "qr" }, ...inputs] : inputs)
    : "";
  const replay = async (
    session?: ClientSession,
  ): Promise<Result<CreatedImportView[], LinkError> | null> => {
    if (!importBatch) return null;
    const receipt = await readImportReceipt<CreatedImportView>(
      ctx,
      importBatch,
      session,
    );
    if (!receipt) return null;
    if (receipt.hash !== hash || receipt.count !== inputs.length)
      return fail("invalid_input", { field: "import_batch" });
    if (!session) await invalidateCreated(receipt.values);
    return ok(receipt.values);
  };
  const prior = await replay();
  if (prior) return prior;
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const prepared: PreparedLinkCreation[] = [];
  const keys = new Set<string>();
  const earlierFailure = async (): Promise<Result<
    CreatedImportView[],
    LinkError
  > | null> => {
    const prior = await replay();
    if (prior) return prior;
    const taken = await takenCreationKeys(
      ctx,
      prepared.filter((item) => item.input.key?.trim()),
    );
    for (const [index, item] of prepared.entries())
      if (taken.has(`${item.domain}/${item.key}`))
        return fail("key_taken", { key: item.key, index });
    return null;
  };
  for (const [index, input] of inputs.entries()) {
    const result = await prepareLinkCreation(
      ctx,
      input,
      entitlements,
      false,
      true,
    );
    if (!result.ok)
      return (
        (await earlierFailure()) ??
        fail(result.error, { ...result.detail, index })
      );
    const identity = `${result.value.domain}/${result.value.key}`;
    if (keys.has(identity))
      return (
        (await earlierFailure()) ??
        fail("key_taken", { key: result.value.key, index })
      );
    keys.add(identity);
    prepared.push(result.value);
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const taken = await takenCreationKeys(ctx, prepared);
    if (!taken.size) break;
    for (const [index, item] of prepared.entries())
      if (taken.has(`${item.domain}/${item.key}`)) {
        if (item.input.key?.trim())
          return (
            (await replay()) ?? fail("key_taken", { key: item.key, index })
          );
        if (attempt === 7)
          throw new Error("Could not generate a free link key");
        keys.delete(`${item.domain}/${item.key}`);
        do {
          item.key = generateKey();
        } while (
          isReservedKey(item.key) ||
          keys.has(`${item.domain}/${item.key}`)
        );
        keys.add(`${item.domain}/${item.key}`);
      }
  }
  const now = nowOf(ctx),
    sub = legacySubOf(ctx);
  let result: Result<CreatedImportView[], LinkError>;
  let committingIndex = 0;
  try {
    result = await withQuotaMutation(
      ctx,
      async (session): Promise<Result<CreatedImportView[], LinkError>> => {
        // Shared with single creates and QR backing links: concurrent v2 requests cannot overspend quota.
        const prior = await replay(session);
        if (prior) return prior;
        const reservation = importBatch
          ? await heldImportBatch(
              ctx,
              importBatch,
              metric,
              inputs.length,
              session,
            )
          : null;
        if (importBatch && !reservation)
          return fail("invalid_input", { field: "import_reservation" });
        const limit = entitlements.limits[metric];
        // An accepted whole-import reservation already owns its remaining capacity.
        if (!reservation && limit !== null) {
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
          if (usage[metric] + reserved[metric] + inputs.length > limit)
            return fail("limit_reached", {
              limit,
              used: usage[metric],
              reserved: reserved[metric],
              requested: inputs.length,
            });
        }
        // Recheck the whole candidate set under the shared mutation lock.
        const taken = await takenCreationKeys(ctx, prepared, session);
        for (const [index, item] of prepared.entries())
          if (taken.has(`${item.domain}/${item.key}`))
            return fail("key_taken", { key: item.key, index });
        const tags = await ensureTags(
          ctx,
          inputs.flatMap((input) => input.tags ?? []),
          session,
        );
        const tagByName = new Map(
          tags.map((tag) => [tag.name.toLowerCase(), tag]),
        );
        const created: CreatedImportView[] = [],
          documents: Documents["links"][] = [],
          qrDocuments: Document[] = [];
        for (const [index, item] of prepared.entries()) {
          committingIndex = index;
          const { input, domain, key, url, passwordHash } = item;
          const qrId = qrImport ? new ObjectId() : undefined;
          const qrCodeId = qrId ? qrId.toHexString() : undefined;
          const ruleSchedule = requestRuleSchedule(input.rules);
          const selectedTags = [
            ...new Set(
              (input.tags ?? []).map((tag) =>
                normalizeTagName(tag).toLowerCase(),
              ),
            ),
          ].flatMap((name) => {
            const tag = tagByName.get(name);
            return tag ? [tag] : [];
          });
          const legacy: Document = {
            _id: new ObjectId(),
            ...(sub ? { sub } : {}),
            domain,
            urlCode: key,
            customCode: Boolean(input.key?.trim()),
            longUrl: url,
            isQrCode: qrImport,
            ...(qrCodeId ? { qrCodeId } : {}),
            title: input.title?.trim() || `${new URL(url).hostname} - untitled`,
            date: now,
            tags: qrImport ? [] : embeddedTags(selectedTags, sub),
            utmLinks: [],
            clicks: { total: 0, lastClick: null },
            passwordProtected: Boolean(input.password),
            ...(input.password
              ? {
                  passwordHash,
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
            requiresInterstitial: qrImport
              ? false
              : entitlements.interstitialByDefault,
          };
          const derived = derive(legacy);
          const doc: Document = {
            ...legacy,
            ...derived.fields,
            workspaceId: ctx.workspace._id,
            ...(importBatch
              ? {
                  importId: new ObjectId(importBatch.id),
                  importRow: importBatch.offset + index,
                }
              : {}),
            safetyScan: requestSafetyScan(now),
            health: requestHealthCheck(url, input.rules, now),
            ...(ruleSchedule ? { ruleSchedule } : {}),
            ...(input.rules ? { rules: storedRules(input.rules) } : {}),
            ...(input.og ? { og: input.og } : {}),
            tagIds: qrImport ? [] : selectedTags.map((tag) => tag._id),
            ...(input.description?.trim()
              ? { description: input.description.trim() }
              : {}),
            previousKeys: [],
            createdAt: now,
            updatedAt: now,
            createdBy: ctx.actor.userId,
            _sync: { rev: 1, lastWriter: "v2", legacyHash: derived.legacyHash },
          };

          const link = doc as Documents["links"];
          documents.push(link);
          if (qrId && qrCodeId) {
            const design = defaultQrDesign(`https://${domain}/${key}`);
            qrDocuments.push({
              _id: qrId,
              ...(sub ? { sub } : {}),
              workspaceId: ctx.workspace._id,
              domain,
              linkId: link._id,
              urlId: key,
              attachedUrl: "",
              qrCodeId,
              publicId: qrCodeId,
              longUrl: url,
              title: link.title,
              tags: embeddedTags(selectedTags, sub),
              tagIds: selectedTags.map((tag) => tag._id),
              options: design,
              design,
              clicks: { total: 0, lastClick: null },
              date: now,
              createdAt: now,
              updatedAt: now,
              createdBy: ctx.actor.userId,
              importId: new ObjectId(importBatch!.id),
              importRow: importBatch!.offset + index,
            });
          }
          created.push({
            ...toLinkView(link, ctx.linkDomain),
            ...(qrId ? { importQrId: qrId.toHexString() } : {}),
          });
        }
        await collection(ctx.db, "links").insertMany(documents, { session });
        if (qrDocuments.length)
          await ctx.db
            .collection(physicalNames.qr_codes)
            .insertMany(qrDocuments, { session });
        await recordWebhookEvents(
          ctx.db,
          ctx.workspace._id,
          documents.map((link) => ({
            type: "link.created" as const,
            data: linkEventData(link, ctx.linkDomain),
          })),
          session,
          now,
        );
        if (reservation && importBatch)
          await finishImportBatch(
            ctx,
            reservation,
            importBatch,
            hash,
            created,
            session,
          );
        if (attach) await attach(created, session);
        return ok(created);
      },
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      if (
        "writeErrors" in error &&
        Array.isArray(error.writeErrors) &&
        typeof error.writeErrors[0]?.index === "number"
      )
        committingIndex = error.writeErrors[0].index;
      return fail("key_taken", {
        key: prepared[committingIndex]!.key,
        index: committingIndex,
      });
    }
    throw error;
  }
  if (!result.ok) return result;
  await invalidateCreated(result.value);
  return result;
}

export interface UpdateLinkInput {
  og?: SocialPreview | null | undefined;
  rules?: LinkRulesInput | null | undefined;
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
  includeDeleted = false,
) {
  const _id = parseObjectId(id);
  if (!_id) return null;
  return collection(ctx.db, "links").findOne({
    $and: [
      { _id, ...(!includeDeleted ? { deletedAt: { $exists: false } } : {}) },
      ownedBy<Link>(ctx.workspace),
    ],
  });
}

export async function getLink(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  id: string,
  options: { includeDeleted?: boolean } = {},
) {
  const link = await findOwned(ctx, id, options.includeDeleted);
  return link ? toLinkView(link, ctx.linkDomain) : null;
}

/** Domain-qualified lookup stays inside the actor's workspace, including legacy root-domain links. */
export async function getLinkByKey(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  key: string,
  domain = ctx.linkDomain,
) {
  if (!keyPattern.test(key)) return null;
  const link = await collection(ctx.db, "links").findOne({
    $and: [
      ownedBy<Link>(ctx.workspace),
      { deletedAt: { $exists: false } },
      {
        $or: [
          ...(domain === ctx.linkDomain
            ? [{ urlCode: key, domain: { $exists: false } }]
            : []),
          { domain, urlCode: key },
          { domain, key },
        ],
      },
    ],
  });
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
  if (isTakenDown(link)) return fail("taken_down");
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const legacy: Document = { ...link };
  const set: Document = {};
  const oldKey = link.urlCode ?? link.key;
  if (input.og !== undefined) {
    if (input.og === null) set.og = undefined;
    else {
      const parsed = socialPreviewSchema.safeParse(input.og);
      if (!parsed.success) return fail("invalid_input", { field: "og" });
      set.og = readSocialPreview(parsed.data)!;
    }
  }
  if (input.rules !== undefined) {
    set.ruleSchedule = requestRuleSchedule(input.rules);
    if (input.rules === null) set.rules = undefined;
    else {
      const parsed = linkRulesInputSchema.safeParse(input.rules);
      if (!parsed.success) return fail("invalid_input", { field: "rules" });
      set.rules = storedRules(parsed.data);
    }
  }

  if (
    input.rules !== undefined &&
    !isDeepStrictEqual(
      ruleDestinations(input.rules),
      ruleDestinations(link.rules),
    )
  ) {
    set.safetyStatus = link.safetyStatus === "blocked" ? "blocked" : "pending";
  }

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

  let previousKey = oldKey;
  let previousKeys = link.previousKeys ?? [];
  let appliedDomain = link.domain ?? ctx.linkDomain;
  try {
    const updated = await withMutation(ctx.db, async (session) => {
      const current = await collection(ctx.db, "links").findOne(
        { _id: link._id, deletedAt: { $exists: false } },
        { session },
      );
      if (!current) return null;
      previousKey = current.urlCode ?? current.key;
      previousKeys = current.previousKeys ?? [];
      appliedDomain = current.domain ?? ctx.linkDomain;
      if (set.safetyStatus !== undefined)
        set.safetyScan = requestSafetyScan(nowOf(ctx));
      const currentLegacy: Document = { ...current, ...set };
      if (
        healthSignature(currentLegacy.longUrl ?? "", currentLegacy.rules) !==
        healthSignature(current.longUrl ?? "", current.rules)
      )
        set.health = requestHealthCheck(
          currentLegacy.longUrl ?? "",
          currentLegacy.rules,
          nowOf(ctx),
        );
      if (input.removePassword) {
        currentLegacy.passwordHash = undefined;
        currentLegacy.passwordHint = undefined;
      }
      if (set.safetyStatus !== undefined)
        currentLegacy.safetyStatus =
          current.safetyStatus === "blocked" ? "blocked" : "pending";
      const derived = withDerived({
        ...currentLegacy,
        domain: currentLegacy.domain ?? ctx.linkDomain,
      });
      const $set: Document = { ...derived.$set, updatedAt: nowOf(ctx) };
      const $unset: Document = { ...derived.$unset };
      for (const [field, value] of Object.entries(set)) {
        if (value === undefined) $unset[field] = "";
        else
          $set[field] =
            field === "safetyStatus" ? currentLegacy.safetyStatus : value;
      }
      const update: Document = {
        $set,
        $inc: { "_sync.rev": 1 },
        ...(Object.keys($unset).length ? { $unset } : {}),
        ...(newKey && previousKey && newKey !== previousKey
          ? { $addToSet: { previousKeys: previousKey } }
          : {}),
      };
      const result = await collection(ctx.db, "links").findOneAndUpdate(
        { _id: link._id, deletedAt: { $exists: false } },
        update,
        { session, returnDocument: "after" },
      );
      if (
        result &&
        newKey &&
        previousKey &&
        newKey !== previousKey &&
        appliedDomain === ctx.linkDomain
      )
        await renameLegacyClicks(ctx, previousKey, newKey, session);
      if (result)
        await recordWebhookEvent(
          ctx.db,
          ctx.workspace._id,
          "link.updated",
          linkEventData(result, ctx.linkDomain),
          session,
          nowOf(ctx),
        );
      return result;
    });
    if (!updated) return fail("not_found");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("key_taken", { key: newKey ?? null });
    throw error;
  }
  await invalidateLinks(
    ctx.cache,
    appliedDomain,
    [oldKey, previousKey, newKey, ...previousKeys].filter(
      (key): key is string => Boolean(key),
    ),
  );
  const updated = await collection(ctx.db, "links").findOne({
    _id: link._id,
    deletedAt: { $exists: false },
  });
  if (!updated) return fail("not_found");
  return ok(toLinkView(updated, ctx.linkDomain));
}

// Legacy's dashboard reads clicks by urlCode; it rewrites them on rename.
async function renameLegacyClicks(
  ctx: ServiceContext,
  from: string,
  to: string,
  session: ClientSession,
) {
  const sub = legacySubOf(ctx);
  if (!sub) return;
  await ctx.db.collection(physicalNames.clicks).updateMany(
    {
      type: "click",
      urlCode: from,
      sub,
      $or: [
        { workspaceId: ctx.workspace._id },
        { workspaceId: { $exists: false } },
      ],
    },
    { $set: { urlCode: to } },
    { session },
  );
}

export const linkTrashRetentionMs = 30 * 86_400_000;

function mutationIds(ids: string[]) {
  if (ids.length > 1000 || ids.some((id) => !parseObjectId(id))) return null;
  return [...new Set(ids)].map((id) => new ObjectId(id));
}

async function notifyLinkLifecycle(ctx: ServiceContext, link: Link) {
  const keys = [link.urlCode ?? link.key, ...(link.previousKeys ?? [])].filter(
    (key): key is string => Boolean(key),
  );
  await invalidateLinks(ctx.cache, link.domain ?? ctx.linkDomain, keys);
  const pages = collection(ctx.db, "bio_pages").find(
    {
      $and: [
        ownedBy<Documents["bio_pages"]>(ctx.workspace, "userId"),
        {
          $or: [
            { "links.link": link._id },
            { "publishedContent.blocks.linkId": link._id.toHexString() },
            { "publishedContent.blocks.items.linkId": link._id.toHexString() },
          ],
        },
      ],
    },
    { projection: { _id: 1 } },
  );
  for await (const page of pages)
    await ctx.db.collection(physicalNames.bio_delivery_jobs).updateOne(
      { bioPageId: page._id },
      {
        $set: {
          nextAttemptAt: nowOf(ctx),
          attempts: 0,
          updatedAt: nowOf(ctx),
        },
      },
      { upsert: true },
    );
}

/** Soft deletion preserves references and reserved keys throughout the restore window. */
export async function deleteLinks(
  ctx: ServiceContext,
  ids: string[],
): Promise<Result<{ deleted: string[] }, LinkError>> {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden");
  const objectIds = mutationIds(ids);
  if (!objectIds) return fail("invalid_input");
  const links = await collection(ctx.db, "links")
    .find({
      $and: [
        { _id: { $in: objectIds }, isQrCode: { $ne: true } },
        ownedBy<Link>(ctx.workspace),
      ],
    })
    .toArray();
  if (links.some((link) => !can(ctx.actor, "resource.delete", link)))
    return fail("forbidden");
  const now = nowOf(ctx),
    deleted: string[] = [];
  for (const link of links) {
    await withMutation(ctx.db, async (session) => {
      const updated = await collection(ctx.db, "links").findOneAndUpdate(
        { _id: link._id, deletedAt: { $exists: false } },
        {
          $set: {
            deletedAt: now,
            updatedAt: now,
            workspaceId: ctx.workspace._id,
          },
        },
        { session, returnDocument: "after" },
      );
      if (updated)
        await recordWebhookEvent(
          ctx.db,
          ctx.workspace._id,
          "link.deleted",
          linkEventData(updated, ctx.linkDomain),
          session,
          now,
        );
    });
    await notifyLinkLifecycle(ctx, link);
    deleted.push(link._id.toHexString());
  }
  return ok({ deleted });
}

export async function restoreLinks(
  ctx: ServiceContext,
  ids: string[],
): Promise<Result<{ restored: string[] }, LinkError>> {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden");
  const objectIds = mutationIds(ids);
  if (!objectIds) return fail("invalid_input");
  const now = nowOf(ctx),
    cutoff = new Date(now.getTime() - linkTrashRetentionMs);
  const links = await collection(ctx.db, "links")
    .find({
      $and: [
        { _id: { $in: objectIds }, isQrCode: { $ne: true } },
        ownedBy<Link>(ctx.workspace),
      ],
    })
    .toArray();
  if (links.some((link) => !can(ctx.actor, "resource.delete", link)))
    return fail("forbidden");
  const restored: string[] = [];
  for (const link of links) {
    if (link.purgingAt || (link.deletedAt && link.deletedAt <= cutoff))
      continue;
    const active = await withMutation(ctx.db, async (session) => {
      const before = await collection(ctx.db, "links").findOne(
        { _id: link._id },
        { session },
      );
      const active = await collection(ctx.db, "links").findOneAndUpdate(
        {
          _id: link._id,
          purgingAt: { $exists: false },
          $or: [
            { deletedAt: { $exists: false } },
            { deletedAt: { $gt: cutoff } },
          ],
        },
        { $unset: { deletedAt: "" }, $set: { updatedAt: now } },
        { returnDocument: "after", session },
      );
      if (active && before?.deletedAt)
        await recordWebhookEvent(
          ctx.db,
          ctx.workspace._id,
          "link.updated",
          linkEventData(active, ctx.linkDomain),
          session,
          now,
        );
      return active;
    });
    if (!active) continue;
    await notifyLinkLifecycle(ctx, active);
    restored.push(active._id.toHexString());
  }
  return ok({ restored });
}

/** Privileged maintenance entry point; no request handler may call this. Cleanup is retryable until the tombstone is removed. */
export async function purgeExpiredLinks(
  deps: Pick<ServiceContext, "db" | "cache" | "linkDomain">,
  now = new Date(),
  limit = 100,
) {
  const cutoff = new Date(now.getTime() - linkTrashRetentionMs);
  const docs = await collection(deps.db, "links")
    .find({ deletedAt: { $lte: cutoff } })
    .sort({ deletedAt: 1, _id: 1 })
    .limit(Math.min(1000, Math.max(1, limit)))
    .toArray();
  let purged = 0;
  for (const doc of docs) {
    if (!doc.workspaceId) continue;
    const workspace = await collection(deps.db, "workspaces").findOne({
      _id: doc.workspaceId,
    });
    if (!workspace) continue;
    const claimed = await collection(deps.db, "links").findOneAndUpdate(
      { _id: doc._id, deletedAt: { $lte: cutoff } },
      { $set: { purgingAt: now } },
      { returnDocument: "after" },
    );
    if (!claimed) continue;
    const ctx: ServiceContext = {
      ...deps,
      workspace,
      actor: { userId: workspace.ownerUserId, role: "owner" },
      now: () => now,
    };
    await deleteOne(ctx, claimed);
    purged++;
  }
  return { purged };
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
  const campaigns = ctx.db.collection<CampaignRefs>(physicalNames.campaigns);
  const affected = await campaigns
    .find(
      {
        $and: [{ links: link._id }, ownedBy<CampaignRefs>(ctx.workspace)],
      },
      { projection: { _id: 1 } },
    )
    .toArray();
  if (affected.length) {
    await campaigns.updateMany(
      {
        $and: [{ links: link._id }, ownedBy<CampaignRefs>(ctx.workspace)],
      },
      { $pull: { links: link._id } },
    );
    await campaigns.deleteMany({
      _id: { $in: affected.map((c) => c._id) },
      links: { $size: 0 },
    });
  }
  await ctx.db.collection<BioRefs>(physicalNames.bio_pages).updateMany(
    {
      $and: [
        { "links.link": link._id },
        ownedBy<BioRefs>(ctx.workspace, "userId"),
      ],
    },
    { $pull: { links: { link: link._id } } },
  );
  await invalidateLinks(ctx.cache, link.domain ?? ctx.linkDomain, invalidate);
  await collection(ctx.db, "links").deleteOne({
    _id: link._id,
    purgingAt: { $exists: true },
  });
}

export interface ListLinksInput {
  campaign?: string | undefined;
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
  trash?: boolean | undefined;
  archived?: boolean | undefined;
  /** Internal review of a fixed selection that may span both library views. */
  includeArchived?: boolean | undefined;
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

/** Shared filtered-view scope for dashboard browsing and streamed exports. */
export async function linkListFilter(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  input: ListLinksInput = {},
): Promise<Filter<Link>> {
  const and: Filter<Link>[] = [
    ownedBy<Link>(ctx.workspace),
    { isQrCode: { $ne: true }, deletedAt: { $exists: input.trash === true } },
    ...(!input.trash && !input.includeArchived
      ? [{ archivedAt: { $exists: input.archived === true } }]
      : []),
    ...(!input.includeHidden && !input.trash
      ? [{ hidden: { $ne: true } }]
      : []),
  ];
  const search = input.search?.trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search.slice(0, 200)), "i");
    and.push({
      $or: [{ urlCode: pattern }, { longUrl: pattern }, { title: pattern }],
    });
  }
  if (input.tags?.length) and.push({ "tags.tagName": { $in: input.tags } });
  if (input.campaign) {
    const campaignId = parseObjectId(input.campaign);
    const campaign = campaignId
      ? await collection(ctx.db, "campaigns").findOne(
          {
            $and: [
              { _id: campaignId },
              ownedBy<Documents["campaigns"]>(ctx.workspace),
            ],
          },
          { projection: { links: 1 } },
        )
      : null;
    and.push({ _id: { $in: campaign?.links ?? [] } });
  }
  if (input.status) and.push(statusFilter[input.status]);
  if (input.createdAfter) and.push({ date: { $gte: input.createdAfter } });
  if (input.createdBefore) and.push({ date: { $lt: input.createdBefore } });
  return { $and: and };
}

// Keyset pagination on (date, _id) descending; `date` is set by both apps.
export async function listLinks(
  ctx: Pick<ServiceContext, "db" | "workspace" | "linkDomain">,
  input: ListLinksInput = {},
) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const and = (await linkListFilter(ctx, input)).$and!;
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
  lease?: SafetyScanLease,
) {
  const fence = lease
    ? {
        "safetyScan.generation": lease.generation,
        "safetyScan.token": lease.token,
      }
    : {};
  const link = await collection(ctx.db, "links").findOne({
    _id: linkId,
    deletedAt: { $exists: false },
    ...fence,
  });
  if (!link?.longUrl) return;
  const targets = [...new Set([link.longUrl, ...ruleDestinations(link.rules)])];
  // At most 36 destinations; four parallel lookups fit inside the worker lease.
  const outcomes: Awaited<ReturnType<typeof scanUrl>>[] = [];
  for (let offset = 0; offset < targets.length; offset += 4)
    outcomes.push(
      ...(await Promise.all(
        targets
          .slice(offset, offset + 4)
          .map((url) => scanUrl(url, { ...deps, cache: ctx.cache })),
      )),
    );
  const outcome = outcomes.reduce((highest, next) =>
    next.riskScore > highest.riskScore ? next : highest,
  );

  const updated = await withMutation(ctx.db, async (session) => {
    const current = await collection(ctx.db, "links").findOne(
      {
        _id: linkId,
        longUrl: link.longUrl,
        deletedAt: { $exists: false },
        ...fence,
      },
      { session },
    );
    if (
      !current ||
      !isDeepStrictEqual(targets, [
        ...new Set([current.longUrl, ...ruleDestinations(current.rules)]),
      ])
    )
      return null;
    const legacy: Document = {
      ...current,
      riskScore: outcome.riskScore,
      safetyStatus:
        current.safetyStatus === "blocked" ? "blocked" : outcome.safetyStatus,
      scanProvider: outcome.scanProvider,
      lastScannedAt: new Date(),
      ...(outcome.disabled && !current.disabled
        ? {
            disabled: true,
            flagged: true,
            disabledReason: outcome.disabledReason,
          }
        : {}),
    };
    const derived = withDerived({
      ...legacy,
      domain: legacy.domain ?? ctx.linkDomain,
    });
    const mutation: Document = {
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
    };
    const saved = await collection(ctx.db, "links").findOneAndUpdate(
      { _id: current._id, longUrl: current.longUrl },
      mutation,
      { session, returnDocument: "after" },
    );
    if (!saved) return null;
    const changed = [
      "riskScore",
      "safetyStatus",
      "disabled",
      "flagged",
      "disabledReason",
    ].some((field) => !isDeepStrictEqual(current[field], saved[field]));
    if (changed) {
      const workspaceId =
        current.workspaceId ??
        (current.sub
          ? (
              await collection(ctx.db, "workspaces").findOne(
                { personal: true, legacySub: current.sub },
                { session, projection: { _id: 1 } },
              )
            )?._id
          : undefined);
      if (workspaceId)
        await recordWebhookEvent(
          ctx.db,
          workspaceId,
          "link.updated",
          linkEventData(saved, ctx.linkDomain),
          session,
        );
    }
    return saved;
  });
  if (updated)
    await invalidateLinks(ctx.cache, updated.domain ?? ctx.linkDomain, [
      updated.key ?? updated.urlCode ?? "",
      ...(updated.previousKeys ?? []),
    ]);
  return {
    applied: Boolean(updated),
    retryReputation: outcomes.some((outcome) => outcome.reputationUnavailable),
  };
}
