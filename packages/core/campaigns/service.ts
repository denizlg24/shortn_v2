import { hasFeature, loadEntitlements } from "@shortn/billing";
import { collection, physicalNames, type Documents } from "@shortn/db";
import { invalidateLinks } from "@shortn/redis";
import type { Document, ObjectId } from "mongodb";
import { fail, ok, type Result } from "../result";
import { can } from "../workspaces/authz";
import { legacySubOf, nowOf, type ServiceContext } from "../workspaces/context";
import { ownedBy, parseObjectId } from "../workspaces/service";

type Campaign = Documents["campaigns"];
type Link = Documents["links"];

export type CampaignError =
  | "forbidden"
  | "feature_required"
  | "not_found"
  | "title_taken"
  | "invalid_title";

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
  };
}

async function gate(ctx: ServiceContext, write: boolean) {
  if (!can(ctx.actor, write ? "resource.update" : "workspace.view"))
    return fail("forbidden");
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
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
) {
  return Boolean(
    await collection(ctx.db, "campaigns").findOne({
      $and: [
        ownedBy<Campaign>(ctx.workspace),
        { title },
        ...(except ? [{ _id: { $ne: except } }] : []),
      ],
    }),
  );
}

async function upsertByTitle(ctx: ServiceContext, title: string) {
  const existing = await collection(ctx.db, "campaigns").findOne({
    $and: [ownedBy<Campaign>(ctx.workspace), { title }],
  });
  if (existing) return existing._id;
  const now = nowOf(ctx);
  const sub = legacySubOf(ctx);
  const inserted = await ctx.db.collection(physicalNames.campaigns).insertOne({
    title,
    ...(sub ? { sub } : {}),
    workspaceId: ctx.workspace._id,
    links: [],
    createdAt: now,
    updatedAt: now,
  });
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
  if (await titleTaken(ctx, title)) return fail("title_taken");
  const id = await upsertByTitle(ctx, title);
  if (input.description?.trim())
    await ctx.db
      .collection(physicalNames.campaigns)
      .updateOne(
        { _id: id },
        { $set: { description: input.description.trim() } },
      );
  const campaign = await collection(ctx.db, "campaigns").findOne({ _id: id });
  if (!campaign) throw new Error("Created campaign vanished");
  return ok(toCampaignView(campaign));
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
  const campaign = await findOwned(ctx, id);
  if (!campaign) return fail("not_found");
  const $set: Document = { updatedAt: nowOf(ctx) };
  const $unset: Document = {};
  let renamedTo: string | undefined;
  if (input.title !== undefined) {
    const title = cleanTitle(input.title);
    if (!title) return fail("invalid_title");
    if (title !== campaign.title) {
      if (await titleTaken(ctx, title, campaign._id))
        return fail("title_taken");
      $set.title = title;
      renamedTo = title;
    }
  }
  if (input.description !== undefined) {
    if (input.description?.trim()) $set.description = input.description.trim();
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
      { _id: campaign._id },
      { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
    );
  // Links carry a copy of the title, and legacy matches variants by it.
  if (renamedTo) {
    const links = ctx.db.collection(physicalNames.links);
    const filter = { "utmLinks.campaign._id": campaign._id };
    const affected = await links
      .find(filter, { projection: { urlCode: 1 } })
      .toArray();
    await links.updateMany(
      filter,
      { $set: { "utmLinks.$[variant].campaign.title": renamedTo } },
      { arrayFilters: [{ "variant.campaign._id": campaign._id }] },
    );
    await invalidateLinks(
      ctx.cache,
      ctx.linkDomain,
      affected.flatMap((link) =>
        typeof link.urlCode === "string" ? [link.urlCode] : [],
      ),
    );
  }
  const updated = await collection(ctx.db, "campaigns").findOne({
    _id: campaign._id,
  });
  if (!updated) return fail("not_found");
  return ok(toCampaignView(updated));
}

export async function deleteCampaign(
  ctx: ServiceContext,
  id: string,
): Promise<Result<null, CampaignError>> {
  const blocked = await gate(ctx, true);
  if (blocked) return blocked;
  const campaign = await findOwned(ctx, id);
  if (!campaign) return ok(null);
  if (!can(ctx.actor, "resource.delete", campaignCreator(campaign)))
    return fail("forbidden");
  await ctx.db
    .collection(physicalNames.campaigns)
    .deleteOne({ _id: campaign._id });
  const links = ctx.db.collection(physicalNames.links);
  const filter = { _id: { $in: campaign.links ?? [] } };
  const affected = await links
    .find(filter, { projection: { urlCode: 1 } })
    .toArray();
  // Legacy removes variants by title (linkActions.ts deleteCampaign).
  await links.updateMany(filter, [
    {
      $set: {
        utmLinks: {
          $filter: {
            input: { $ifNull: ["$utmLinks", []] },
            cond: { $ne: ["$$this.campaign.title", campaign.title] },
          },
        },
      },
    },
  ]);
  await invalidateLinks(
    ctx.cache,
    ctx.linkDomain,
    affected.flatMap((link) =>
      typeof link.urlCode === "string" ? [link.urlCode] : [],
    ),
  );
  return ok(null);
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
): Promise<Result<null, CampaignError>> {
  const blocked = await gate(ctx, true);
  if (blocked) return blocked;
  const _id = parseObjectId(linkId);
  const link = _id
    ? await collection(ctx.db, "links").findOne({
        $and: [{ _id }, ownedBy<Link>(ctx.workspace)],
      })
    : null;
  if (!link) return fail("not_found");
  const clean = (value: string | undefined) => value?.trim() || undefined;
  const titles = [
    ...new Set(
      variants.flatMap((v) =>
        clean(v.campaign) ? [cleanTitle(v.campaign ?? "")] : [],
      ),
    ),
  ];
  const ids = new Map<string, ObjectId>();
  for (const title of titles) ids.set(title, await upsertByTitle(ctx, title));
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
  const campaigns = ctx.db.collection<{ links: ObjectId[] }>(
    physicalNames.campaigns,
  );
  const before = (link.utmLinks ?? []).flatMap((entry) => {
    const id: unknown = entry.campaign?._id;
    return id && typeof id === "object" && "toHexString" in id
      ? [String(id)]
      : [];
  });
  const kept = new Set([...ids.values()].map(String));
  const removed = before.filter((id) => !kept.has(id));
  await ctx.db
    .collection(physicalNames.links)
    .updateOne(
      { _id: link._id },
      { $set: { utmLinks, updatedAt: nowOf(ctx) } },
    );
  if (ids.size)
    await campaigns.updateMany(
      { _id: { $in: [...ids.values()] } },
      { $addToSet: { links: link._id } },
    );
  if (removed.length) {
    const removedIds = removed.flatMap((id) => parseObjectId(id) ?? []);
    await campaigns.updateMany(
      { _id: { $in: removedIds } },
      { $pull: { links: link._id } },
    );
    await campaigns.deleteMany({
      _id: { $in: removedIds },
      links: { $size: 0 },
    });
  }
  const key = link.urlCode ?? link.key;
  if (key) await invalidateLinks(ctx.cache, ctx.linkDomain, [key]);
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
        { _id: { $in: campaign.links ?? [] } },
        ownedBy<Link>(ctx.workspace),
      ],
    })
    .toArray();
  return { campaign, links };
}
