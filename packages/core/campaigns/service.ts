import { hasFeature, loadEntitlements } from "@shortn/billing";
import {
  collection,
  deriveLink,
  deriveLinkUtm,
  physicalNames,
  type Documents,
} from "@shortn/db";
import { invalidateLinks } from "@shortn/redis";
import type { Document, Filter, ObjectId, ClientSession } from "mongodb";
import {
  withMutation,
  recordWebhookEvent,
  linkEventData,
} from "../webhooks/events";
import { isDeepStrictEqual } from "node:util";
import { fail, ok, type Result } from "../result";
import { can } from "../workspaces/authz";
import { legacySubOf, nowOf, type ServiceContext } from "../workspaces/context";
import { ownedBy, parseObjectId } from "../workspaces/service";
import { isTakenDown } from "../links/moderation";

type Campaign = Documents["campaigns"];
type Link = Documents["links"];

export type CampaignError =
  | "forbidden"
  | "feature_required"
  | "not_found"
  | "title_taken"
  | "invalid_title"
  | "conflict"
  | "taken_down";

export interface UtmDefaults {
  sources: string[];
  mediums: string[];
  terms: string[];
  contents: string[];
}

export interface CampaignView {
  id: string;
  title: string;
  description: string | null;
  linkCount: number;
  utmDefaults: UtmDefaults;
  createdAt: string;
  createdBy: string | null;
}

export interface UtmVariant {
  source?: string | undefined;
  medium?: string | undefined;
  term?: string | undefined;
  content?: string | undefined;
  campaign?: string | undefined;
}

const list = (value: string[] | undefined) => value ?? [];

export function toCampaignView(campaign: Campaign): CampaignView {
  return {
    id: campaign._id.toHexString(),
    title: campaign.title,
    description: campaign.description ?? null,
    linkCount: campaign.links?.length ?? 0,
    utmDefaults: {
      sources: list(campaign.utmDefaults?.sources),
      mediums: list(campaign.utmDefaults?.mediums),
      terms: list(campaign.utmDefaults?.terms),
      contents: list(campaign.utmDefaults?.contents),
    },
    createdAt: (
      campaign.createdAt ?? campaign._id.getTimestamp()
    ).toISOString(),
    createdBy:
      typeof campaign.createdBy === "string" ? campaign.createdBy : null,
  };
}

async function gate(ctx: ServiceContext, write: boolean) {
  if (!can(ctx.actor, write ? "resource.update" : "workspace.view"))
    return fail("forbidden");
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace);
  if (!hasFeature(entitlements, "campaigns"))
    return fail("feature_required", { feature: "campaigns" });
  return null;
}

const cleanTitle = (title: string) =>
  title.trim().replace(/\s+/g, " ").slice(0, 80);

export async function listCampaigns(
  ctx: Pick<ServiceContext, "db" | "workspace">,
) {
  const campaigns = await collection(ctx.db, "campaigns")
    .find(ownedBy<Campaign>(ctx.workspace))
    .sort({ createdAt: -1, _id: -1 })
    .toArray();
  return campaigns.map(toCampaignView);
}

/** Bounded API listing computes counts without transferring every campaign link ID. */
export async function pageCampaigns(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  input: {
    cursor?: string | undefined;
    search?: string | undefined;
    limit?: number | undefined;
  } = {},
) {
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const and: Filter<Campaign>[] = [ownedBy<Campaign>(ctx.workspace)];
  const search = input.search?.trim().slice(0, 200);
  if (search)
    and.push({
      title: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    });
  const total = input.cursor
    ? null
    : await collection(ctx.db, "campaigns").countDocuments({ $and: and });
  const cursor = input.cursor ? parseObjectId(input.cursor) : null;
  if (cursor) and.push({ _id: { $lt: cursor } });
  const docs = await collection(ctx.db, "campaigns")
    .aggregate<Campaign & { linkCount: number }>([
      { $match: { $and: and } },
      { $sort: { _id: -1 } },
      { $limit: limit + 1 },
      { $set: { linkCount: { $size: { $ifNull: ["$links", []] } } } },
      { $unset: "links" },
    ])
    .toArray();
  const page = docs.slice(0, limit);
  return {
    items: page.map((campaign) => ({
      ...toCampaignView(campaign),
      linkCount: campaign.linkCount,
    })),
    total,
    nextCursor: docs.length > limit ? page.at(-1)!._id.toHexString() : null,
  };
}

async function findOwned(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const _id = parseObjectId(id);
  if (!_id) return null;
  return collection(ctx.db, "campaigns").findOne({
    $and: [{ _id }, ownedBy<Campaign>(ctx.workspace)],
  });
}

export async function getCampaign(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const campaign = await findOwned(ctx, id);
  return campaign ? toCampaignView(campaign) : null;
}

async function titleTaken(
  ctx: ServiceContext,
  title: string,
  except?: ObjectId,
  session?: ClientSession,
) {
  return Boolean(
    await collection(ctx.db, "campaigns").findOne(
      {
        $and: [
          ownedBy<Campaign>(ctx.workspace),
          { title },
          ...(except ? [{ _id: { $ne: except } }] : []),
        ],
      },
      session ? { session } : {},
    ),
  );
}

async function upsertByTitle(
  ctx: ServiceContext,
  title: string,
  session?: ClientSession,
) {
  const existing = await collection(ctx.db, "campaigns").findOne(
    {
      $and: [ownedBy<Campaign>(ctx.workspace), { title }],
    },
    session ? { session } : {},
  );
  if (existing) return existing._id;
  const now = nowOf(ctx);
  const sub = legacySubOf(ctx);
  const inserted = await ctx.db.collection(physicalNames.campaigns).insertOne(
    {
      title,
      ...(sub ? { sub } : {}),
      workspaceId: ctx.workspace._id,
      links: [],
      createdBy: ctx.actor.userId,
      createdAt: now,
      updatedAt: now,
    },
    session ? { session } : {},
  );
  return inserted.insertedId;
}

export async function createCampaign(
  ctx: ServiceContext,
  input: { title: string; description?: string | undefined },
): Promise<Result<CampaignView, CampaignError>> {
  const blocked = await gate(ctx, true);
  if (blocked) return blocked;
  const title = cleanTitle(input.title);
  if (!title) return fail("invalid_title");
  return withMutation(ctx.db, async (session) => {
    await collection(ctx.db, "workspaces").updateOne(
      { _id: ctx.workspace._id },
      { $inc: { campaignMutationRevision: 1 } },
      { session },
    );
    if (await titleTaken(ctx, title, undefined, session))
      return fail("title_taken" as const);
    const id = await upsertByTitle(ctx, title, session);
    if (input.description?.trim())
      await ctx.db
        .collection(physicalNames.campaigns)
        .updateOne(
          { _id: id },
          { $set: { description: input.description.trim() } },
          { session },
        );
    const campaign = await collection(ctx.db, "campaigns").findOne(
      { _id: id },
      { session },
    );
    if (!campaign) throw new Error("Created campaign vanished");
    return ok(toCampaignView(campaign));
  });
}

const normalizeList = (values: string[]) => [
  ...new Set(values.map((value) => value.toLowerCase().trim()).filter(Boolean)),
];

export async function updateCampaign(
  ctx: ServiceContext,
  id: string,
  input: {
    title?: string | undefined;
    description?: string | null | undefined;
    utmDefaults?: UtmDefaults | undefined;
  },
): Promise<Result<CampaignView, CampaignError>> {
  const blocked = await gate(ctx, true);
  if (blocked) return blocked;
  const _id = parseObjectId(id);
  if (!_id) return fail("not_found");
  if (input.title !== undefined && !cleanTitle(input.title))
    return fail("invalid_title");
  const result = await withMutation(ctx.db, async (session) => {
    await collection(ctx.db, "workspaces").updateOne(
      { _id: ctx.workspace._id },
      { $inc: { campaignMutationRevision: 1 } },
      { session },
    );
    const campaign = await collection(ctx.db, "campaigns").findOne(
      { $and: [{ _id }, ownedBy<Campaign>(ctx.workspace)] },
      { session },
    );
    if (!campaign) return fail("not_found" as const);
    const $set: Document = { updatedAt: nowOf(ctx) },
      $unset: Document = {};
    const title =
      input.title === undefined ? campaign.title : cleanTitle(input.title);
    if (title !== campaign.title) {
      if (await titleTaken(ctx, title, campaign._id, session))
        return fail("title_taken" as const);
      $set.title = title;
    }
    if (input.description !== undefined) {
      if (input.description?.trim())
        $set.description = input.description.trim();
      else $unset.description = "";
    }
    if (input.utmDefaults)
      $set.utmDefaults = {
        sources: normalizeList(input.utmDefaults.sources),
        mediums: normalizeList(input.utmDefaults.mediums),
        terms: normalizeList(input.utmDefaults.terms),
        contents: normalizeList(input.utmDefaults.contents),
      };
    await ctx.db
      .collection(physicalNames.campaigns)
      .updateOne(
        { _id },
        { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
        { session },
      );
    const changed: { keys: string[]; domain: string }[] = [];
    if (title !== campaign.title) {
      for await (const link of collection(ctx.db, "links")
        .find(
          {
            $and: [ownedBy<Link>(ctx.workspace), campaignReferences(campaign)],
          },
          { session },
        )
        .batchSize(100)) {
        const variants = (link.utmLinks ?? []).map((variant) =>
          matchesCampaign(variant, campaign)
            ? {
                ...variant,
                campaign: { ...variant.campaign, _id: campaign._id, title },
              }
            : variant,
        );
        const updated = await updateCampaignLink(ctx, link, variants, session);
        if (updated)
          changed.push({
            keys: [
              updated.key ?? updated.urlCode ?? "",
              ...(updated.previousKeys ?? []),
            ],
            domain: updated.domain ?? ctx.linkDomain,
          });
      }
    }
    const updated = await collection(ctx.db, "campaigns").findOne(
      { _id },
      { session },
    );
    if (!updated) throw new Error("Updated campaign vanished");
    return ok({ campaign: updated, changed });
  });
  if (!result.ok) return result;
  for (const link of result.value.changed)
    await invalidateLinks(ctx.cache, link.domain, link.keys);
  return ok(toCampaignView(result.value.campaign));
}

export async function deleteCampaign(
  ctx: ServiceContext,
  id: string,
): Promise<Result<null, CampaignError>> {
  const blocked = await gate(ctx, true);
  if (blocked) return blocked;
  const _id = parseObjectId(id);
  if (!_id) return ok(null);
  const result = await withMutation(ctx.db, async (session) => {
    await collection(ctx.db, "workspaces").updateOne(
      { _id: ctx.workspace._id },
      { $inc: { campaignMutationRevision: 1 } },
      { session },
    );
    const campaign = await collection(ctx.db, "campaigns").findOne(
      { $and: [{ _id }, ownedBy<Campaign>(ctx.workspace)] },
      { session },
    );
    if (!campaign) return ok([] as { keys: string[]; domain: string }[]);
    if (!can(ctx.actor, "resource.delete", campaignCreator(campaign)))
      return fail("forbidden" as const);
    const changed: { keys: string[]; domain: string }[] = [];
    for await (const link of collection(ctx.db, "links")
      .find(
        { $and: [ownedBy<Link>(ctx.workspace), campaignReferences(campaign)] },
        { session },
      )
      .batchSize(100)) {
      const variants = (link.utmLinks ?? []).filter(
        (variant) => !matchesCampaign(variant, campaign),
      );
      const updated = await updateCampaignLink(ctx, link, variants, session);
      if (updated)
        changed.push({
          keys: [
            updated.key ?? updated.urlCode ?? "",
            ...(updated.previousKeys ?? []),
          ],
          domain: updated.domain ?? ctx.linkDomain,
        });
    }
    await ctx.db
      .collection(physicalNames.campaigns)
      .deleteOne({ _id }, { session });
    return ok(changed);
  });
  if (!result.ok) return result;
  for (const link of result.value)
    await invalidateLinks(ctx.cache, link.domain, link.keys);
  return ok(null);
}

function campaignReferences(campaign: Campaign): Filter<Link> {
  return {
    $or: [
      { "utmLinks.campaign._id": campaign._id },
      {
        utmLinks: {
          $elemMatch: {
            "campaign._id": { $exists: false },
            "campaign.title": campaign.title,
          },
        },
      },
    ],
  };
}
function matchesCampaign(
  variant: NonNullable<Link["utmLinks"]>[number],
  campaign: Campaign,
) {
  return variant.campaign?._id
    ? String(variant.campaign._id) === String(campaign._id)
    : variant.campaign?.title === campaign.title;
}

const campaignCreator = (campaign: Campaign | null) => ({
  createdBy:
    typeof campaign?.createdBy === "string" ? campaign.createdBy : undefined,
});

// Port of legacy updateUTM: replaces a link's variants, creates campaigns by
// title, keeps campaign membership in sync and deletes campaigns it empties.
export async function setLinkUtm(
  ctx: ServiceContext,
  linkId: string,
  variants: UtmVariant[],
  /** Reject a form opened before another editor changed the variants. */
  expected?: readonly UtmVariant[],
): Promise<Result<null, CampaignError>> {
  const blocked = await gate(ctx, true);
  if (blocked) return blocked;
  const result = await withMutation(ctx.db, async (session) => {
    await collection(ctx.db, "workspaces").updateOne(
      { _id: ctx.workspace._id },
      { $inc: { campaignMutationRevision: 1 } },
      { session },
    );
    const _id = parseObjectId(linkId);
    const link = _id
      ? await collection(ctx.db, "links").findOne(
          {
            $and: [
              { _id, deletedAt: { $exists: false } },
              ownedBy<Link>(ctx.workspace),
            ],
          },
          { session },
        )
      : null;
    if (!link) return fail("not_found" as const);
    if (isTakenDown(link)) return fail("taken_down" as const);
    const current = (link.utmLinks ?? []).map((variant) => ({
      source: typeof variant.source === "string" ? variant.source : undefined,
      medium: typeof variant.medium === "string" ? variant.medium : undefined,
      campaign: variant.campaign?.title,
      term: typeof variant.term === "string" ? variant.term : undefined,
      content:
        typeof variant.content === "string" ? variant.content : undefined,
    }));
    const snapshot = (items: readonly UtmVariant[]) =>
      JSON.stringify(
        items.map((item) => [
          item.source || "",
          item.medium || "",
          item.campaign || "",
          item.term || "",
          item.content || "",
        ]),
      );
    if (expected && snapshot(current) !== snapshot(expected))
      return fail("conflict" as const);
    const clean = (value: string | undefined) => value?.trim() || undefined;
    const titles = [
      ...new Set(
        variants.flatMap((v) =>
          clean(v.campaign) ? [cleanTitle(v.campaign ?? "")] : [],
        ),
      ),
    ];
    const ids = new Map<string, ObjectId>();
    for (const title of titles)
      ids.set(title, await upsertByTitle(ctx, title, session));
    const utmLinks = variants.map((variant) => {
      const title = clean(variant.campaign)
        ? cleanTitle(variant.campaign ?? "")
        : "";
      const campaignId = ids.get(title);
      return {
        ...(clean(variant.source) ? { source: clean(variant.source) } : {}),
        ...(clean(variant.medium) ? { medium: clean(variant.medium) } : {}),
        campaign: campaignId ? { _id: campaignId, title } : { title: "" },
        ...(clean(variant.term) ? { term: clean(variant.term) } : {}),
        ...(clean(variant.content) ? { content: clean(variant.content) } : {}),
      };
    });
    const campaigns = ctx.db.collection<{
      links: ObjectId[];
      workspaceId?: ObjectId;
    }>(physicalNames.campaigns);
    const before = (link.utmLinks ?? []).flatMap((entry) => {
      const id: unknown = entry.campaign?._id;
      return id && typeof id === "object" && "toHexString" in id
        ? [String(id)]
        : [];
    });
    const kept = new Set([...ids.values()].map(String));
    const removed = before.filter((id) => !kept.has(id));
    const updated = await updateCampaignLink(ctx, link, utmLinks, session);
    if (!updated) return fail("conflict" as const);
    if (ids.size)
      await campaigns.updateMany(
        {
          $and: [
            { _id: { $in: [...ids.values()] } },
            ownedBy<{ links: ObjectId[]; workspaceId?: ObjectId }>(
              ctx.workspace,
            ),
          ],
        },
        { $addToSet: { links: link._id } },
        { session },
      );
    if (removed.length) {
      const removedIds = removed.flatMap((id) => parseObjectId(id) ?? []);
      await campaigns.updateMany(
        {
          $and: [
            { _id: { $in: removedIds } },
            ownedBy<{ links: ObjectId[]; workspaceId?: ObjectId }>(
              ctx.workspace,
            ),
          ],
        },
        { $pull: { links: link._id } },
        { session },
      );
      await campaigns.deleteMany(
        {
          $and: [
            { _id: { $in: removedIds }, links: { $size: 0 } },
            ownedBy<{ links: ObjectId[]; workspaceId?: ObjectId }>(
              ctx.workspace,
            ),
          ],
        },
        { session },
      );
    }
    return ok(updated);
  });
  if (!result.ok) return result;
  const link = result.value;
  const key = link.key ?? link.urlCode;
  if (key)
    await invalidateLinks(ctx.cache, link.domain ?? ctx.linkDomain, [
      key,
      ...(link.previousKeys ?? []),
    ]);
  return ok(null);
}

export async function campaignLinks(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const campaign = await findOwned(ctx, id);
  if (!campaign) return null;
  const links = await collection(ctx.db, "links")
    .find({
      $and: [
        { _id: { $in: campaign.links ?? [] }, deletedAt: { $exists: false } },
        ownedBy<Link>(ctx.workspace),
      ],
    })
    .toArray();
  return { campaign, links };
}

async function updateCampaignLink(
  ctx: ServiceContext,
  link: Link,
  utmLinks: unknown[],
  session: ClientSession,
) {
  if (isDeepStrictEqual(link.utmLinks ?? [], utmLinks)) return link;
  const derived = deriveLink({
    ...link,
    domain: link.domain ?? ctx.linkDomain,
    utmLinks,
  });
  const canonicalUtm = deriveLinkUtm({ utmLinks });
  const fields: Document = {};
  for (const [field, value] of Object.entries(derived.set))
    if (!field.startsWith("_sync.")) fields[field] = value;
  const mutation: Document = {
    $set: {
      ...fields,
      utmLinks,
      utmVariants: canonicalUtm.variants,
      "_sync.utmHash": canonicalUtm.hash,
      updatedAt: nowOf(ctx),
      "_sync.legacyHash": derived.legacyHash,
      "_sync.lastWriter": "v2",
    },
    $inc: { "_sync.rev": 1 },
  };
  const updated = await collection(ctx.db, "links").findOneAndUpdate(
    { _id: link._id },
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

/** Move a bounded selection atomically, retaining every authored UTM variant. */
export async function moveLinksToCampaign(
  ctx: ServiceContext,
  ids: string[],
  campaignId: string,
): Promise<
  Result<
    {
      selected: number;
      updated: number;
      campaign: { id: string; title: string };
    },
    CampaignError | "invalid_input"
  >
> {
  const blocked = await gate(ctx, true);
  if (blocked) return blocked;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 500 ||
    ids.some((id) => typeof id !== "string" || !/^[a-f\d]{24}$/.test(id))
  )
    return fail("invalid_input");
  const targetId =
    typeof campaignId === "string" ? parseObjectId(campaignId) : null;
  if (!targetId) return fail("invalid_input");
  const selected = [...new Set(ids)].map((id) => parseObjectId(id)!);
  const result = await withMutation(ctx.db, async (session) => {
    // Campaign rename/delete and single-link UTM edits take this same fence.
    await collection(ctx.db, "workspaces").updateOne(
      { _id: ctx.workspace._id },
      { $inc: { campaignMutationRevision: 1 } },
      { session },
    );
    const target = await collection(ctx.db, "campaigns").findOne(
      { $and: [{ _id: targetId }, ownedBy<Campaign>(ctx.workspace)] },
      { session, projection: { links: 0 } },
    );
    if (!target) return fail("not_found" as const);
    const links = await collection(ctx.db, "links")
      .find(
        {
          $and: [
            ownedBy<Link>(ctx.workspace),
            {
              _id: { $in: selected },
              deletedAt: { $exists: false },
              hidden: { $ne: true },
              isQrCode: { $ne: true },
            },
          ],
        },
        { session },
      )
      .toArray();
    if (links.length !== selected.length) return fail("not_found" as const);
    if (links.some(isTakenDown)) return fail("taken_down" as const);
    const changed: { domain: string; keys: string[] }[] = [];
    for (const link of links) {
      const variants = (link.utmLinks?.length ? link.utmLinks : [{}]).map(
        (variant) => ({
          ...variant,
          campaign: { _id: target._id, title: target.title },
        }),
      );
      if (isDeepStrictEqual(link.utmLinks ?? [], variants)) continue;
      const updated = await updateCampaignLink(ctx, link, variants, session);
      if (!updated)
        throw new Error(
          "Selected campaign link disappeared inside transaction",
        );
      changed.push({
        domain: updated.domain ?? ctx.linkDomain,
        keys: [
          updated.key ?? updated.urlCode ?? "",
          ...(updated.previousKeys ?? []),
        ],
      });
    }
    // Backlinks can exist without a legacy UTM object. Remove all owned old
    // memberships without deleting the user's now-empty campaign containers.
    const campaigns = ctx.db.collection<{
      _id: ObjectId;
      links: ObjectId[];
      workspaceId?: ObjectId | undefined;
      sub?: string | undefined;
    }>(physicalNames.campaigns);
    const removeMemberships: Document = { $pull: { links: { $in: selected } } };
    await campaigns.updateMany(
      {
        $and: [
          ownedBy<{
            _id: ObjectId;
            links: ObjectId[];
            workspaceId?: ObjectId | undefined;
            sub?: string | undefined;
          }>(ctx.workspace),
          { _id: { $ne: target._id }, links: { $in: selected } },
        ],
      },
      removeMemberships,
      { session },
    );
    await campaigns.updateOne(
      { _id: target._id },
      { $addToSet: { links: { $each: selected } } },
      { session },
    );
    return ok({
      selected: selected.length,
      updated: changed.length,
      campaign: { id: target._id.toHexString(), title: target.title },
      invalidate: links.map((link) => ({
        domain: link.domain ?? ctx.linkDomain,
        keys: [link.key ?? link.urlCode ?? "", ...(link.previousKeys ?? [])],
      })),
    });
  });
  if (!result.ok) return result;
  const domains = new Map<string, Set<string>>();
  for (const link of result.value.invalidate) {
    const keys = domains.get(link.domain) ?? new Set<string>();
    for (const key of link.keys) if (key) keys.add(key);
    domains.set(link.domain, keys);
  }
  for (const [domain, keys] of domains)
    await invalidateLinks(ctx.cache, domain, keys);
  return ok({
    selected: result.value.selected,
    updated: result.value.updated,
    campaign: result.value.campaign,
  });
}
