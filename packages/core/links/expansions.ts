import { collection, type Documents } from "@shortn/db";
import { ObjectId } from "mongodb";
import { ownedBy } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import { tagName, tagView, type TagView } from "../tags/service";
import { toCampaignView, type CampaignView } from "../campaigns/service";
import type { LinkView } from "./service";

export type LinkExpansion = "tags" | "campaign";
export type ExpandedLinkView = LinkView & {
  expanded?: { tags?: TagView[]; campaign?: CampaignView[] };
};

/** Join only the requested page, never the whole workspace library. Callers enforce resource scopes. */
export async function expandLinks(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  links: readonly LinkView[],
  fields: readonly LinkExpansion[],
): Promise<ExpandedLinkView[]> {
  if (links.length > 200)
    throw new Error("Link expansion is limited to 200 links");
  if (!links.length || !fields.length) return [...links];
  const source = await collection(ctx.db, "links")
    .find(
      {
        $and: [
          ownedBy(ctx.workspace),
          { _id: { $in: links.map((link) => new ObjectId(link.id)) } },
        ],
      },
      { projection: { tags: 1, utmLinks: 1 } },
    )
    .toArray();
  const wantsTags = fields.includes("tags"),
    wantsCampaign = fields.includes("campaign");
  const tagIds = new Set<string>(),
    tagNames = new Set<string>();
  const campaignIds = new Map<string, ObjectId>(),
    campaignTitles = new Set<string>();
  for (const link of source) {
    if (wantsTags)
      for (const tag of link.tags ?? []) {
        if (tag._id) tagIds.add(String(tag._id));
        else if (tag.id) tagIds.add(tag.id);
        else tagNames.add(tagName(tag));
      }
    if (wantsCampaign)
      for (const variant of link.utmLinks ?? []) {
        const campaign = variant.campaign;
        if (campaign?._id) campaignIds.set(String(campaign._id), campaign._id);
        else if (campaign?.title) campaignTitles.add(campaign.title);
      }
  }
  const [tags, campaigns] = await Promise.all([
    wantsTags && (tagIds.size || tagNames.size)
      ? collection(ctx.db, "tags")
          .find(
            {
              $and: [
                ownedBy(ctx.workspace),
                { mergedInto: { $exists: false } },
                {
                  $or: [
                    {
                      _id: {
                        $in: [...tagIds]
                          .filter(ObjectId.isValid)
                          .map((id) => new ObjectId(id)),
                      },
                    },
                    { id: { $in: [...tagIds] } },
                    { legacyIds: { $in: [...tagIds] } },
                    { name: { $in: [...tagNames] } },
                    { tagName: { $in: [...tagNames] } },
                  ],
                },
              ],
            },
            {
              projection: {
                name: 1,
                tagName: 1,
                id: 1,
                legacyIds: 1,
                createdAt: 1,
                createdBy: 1,
              },
            },
          )
          .toArray()
      : [],
    wantsCampaign && (campaignIds.size || campaignTitles.size)
      ? collection(ctx.db, "campaigns")
          .aggregate<Documents["campaigns"] & { linkCount: number }>([
            {
              $match: {
                $and: [
                  ownedBy(ctx.workspace),
                  {
                    $or: [
                      { _id: { $in: [...campaignIds.values()] } },
                      { title: { $in: [...campaignTitles] } },
                    ],
                  },
                ],
              },
            },
            {
              $project: {
                title: 1,
                description: 1,
                utmDefaults: 1,
                createdAt: 1,
                createdBy: 1,
                linkCount: { $size: { $ifNull: ["$links", []] } },
              },
            },
          ])
          .toArray()
      : [],
  ]);
  const tagById = new Map<string, Documents["tags"]>();
  const tagByName = new Map(tags.map((tag) => [tagName(tag), tag]));
  for (const tag of tags)
    for (const id of [String(tag._id), tag.id, ...(tag.legacyIds ?? [])]) {
      if (id) tagById.set(id, tag);
    }
  const campaignById = new Map(
    campaigns.map((campaign) => [String(campaign._id), campaign]),
  );
  const campaignByTitle = new Map(
    campaigns.map((campaign) => [campaign.title, campaign]),
  );
  const sourceById = new Map(source.map((link) => [String(link._id), link]));
  return links.map((link) => {
    const raw = sourceById.get(link.id);
    // A deleted/moved record between the page read and join has no expanded data.
    const selectedTags = new Map<string, TagView>();
    const selectedCampaigns = new Map<string, CampaignView>();
    if (wantsTags)
      for (const ref of raw?.tags ?? []) {
        const tag = ref._id
          ? tagById.get(String(ref._id))
          : ref.id
            ? tagById.get(ref.id)
            : tagByName.get(tagName(ref));
        if (tag) selectedTags.set(String(tag._id), tagView(tag));
      }
    if (wantsCampaign)
      for (const ref of raw?.utmLinks ?? []) {
        const campaign = ref.campaign?._id
          ? campaignById.get(String(ref.campaign._id))
          : campaignByTitle.get(ref.campaign?.title ?? "");
        if (campaign)
          selectedCampaigns.set(String(campaign._id), {
            ...toCampaignView(campaign),
            linkCount: campaign.linkCount,
          });
      }
    return {
      ...link,
      expanded: {
        ...(wantsTags ? { tags: [...selectedTags.values()] } : {}),
        ...(wantsCampaign ? { campaign: [...selectedCampaigns.values()] } : {}),
      },
    };
  });
}
