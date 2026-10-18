import { loadEntitlements } from "@shortn/billing";
import { collection, physicalNames, type Documents } from "@shortn/db";
import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { fail, ok, type Result } from "../result";
import { reservedKeys } from "../routing";
import { can } from "../workspaces/authz";
import { legacySubOf, nowOf, type ServiceContext } from "../workspaces/context";
import { ownedBy, parseObjectId } from "../workspaces/service";

import { validBioHandle } from "./hosts";

type BioPage = Documents["bio_pages"];
type Link = Documents["links"];

// Coexistence (16 §4.5): legacy renders /b/{slug} from these legacy fields,
// so the editor writes them; continuous M8 derives the v2 blocks from them.
const color = z
  .string()
  .trim()
  .max(32)
  .regex(/^(#[0-9a-fA-F]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/);
const httpUrl = z.httpUrl().max(2048);
// Uploaded assets also use localhost/IP origins during local development.
const imageUrl = z.url({ protocol: /^https?$/ }).max(2048);
const size = z.string().trim().max(16);

export const bioThemeSchema = z.object({
  primaryColor: color.optional(),
  buttonTextColor: color.optional(),
  background: z.string().trim().max(512).optional(),
  textColor: color.optional(),
  buttonStyle: z.enum(["rounded", "square", "pill"]).optional(),
  font: z.string().trim().max(64).optional(),
  titleFontSize: size.optional(),
  titleFontWeight: size.optional(),
  descriptionFontSize: size.optional(),
  descriptionFontWeight: size.optional(),
  buttonFontSize: size.optional(),
  buttonFontWeight: size.optional(),
  header: z
    .object({
      headerStyle: z.enum(["centered", "left-aligned", "right-aligned"]),
      headerBackgroundImage: imageUrl.optional(),
      headerBackgroundColor: color.optional(),
    })
    .optional(),
});

export const bioPatchSchema = z.object({
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  avatarUrl: imageUrl.or(z.literal("")).optional(),
  avatarShape: z.enum(["circle", "square", "rounded"]).optional(),
  theme: bioThemeSchema.optional(),
  socials: z
    .array(
      z.object({ platform: z.string().trim().min(1).max(32), url: httpUrl }),
    )
    .max(20)
    .optional(),
  socialColor: z.string().trim().max(32).optional(),
});
export type BioPatch = z.infer<typeof bioPatchSchema>;

export const bioLinksSchema = z
  .array(
    z.object({
      linkId: z.string(),
      title: z.string().trim().max(120).optional(),
      image: imageUrl.optional(),
    }),
  )
  .max(100);
export type BioLinksInput = z.infer<typeof bioLinksSchema>;

export interface BioSummary {
  id: string;
  slug: string;
  title: string;
  linkCount: number;
  avatarUrl: string | null;
  updatedAt: string;
  createdBy: string | null;
}

export interface BioEditable extends BioSummary {
  description: string;
  avatarShape: "circle" | "square" | "rounded";
  theme: z.infer<typeof bioThemeSchema>;
  socials: { platform: string; url: string }[];
  socialColor: string;
  links: {
    linkId: string;
    title: string;
    image: string | null;
    key: string;
    url: string;
  }[];
}

export type BioError =
  | "forbidden"
  | "not_found"
  | "invalid_slug"
  | "slug_taken"
  | "limit_reached"
  | "invalid_input"
  | "link_not_found";

const str = (value: unknown) => (typeof value === "string" ? value : undefined);

function summary(page: BioPage): BioSummary {
  return {
    id: page._id.toHexString(),
    slug: page.slug ?? page.handle ?? "",
    title: page.title ?? "",
    linkCount: page.links?.length ?? 0,
    avatarUrl: str(page.avatarUrl) ?? null,
    updatedAt: (
      page.updatedAt ??
      page.createdAt ??
      page._id.getTimestamp()
    ).toISOString(),
    createdBy: typeof page.createdBy === "string" ? page.createdBy : null,
  };
}

const bioPageCursorInput = z.object({
  cursor: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  limit: z.number().int().min(1).max(200).default(50),
  search: z.string().max(200).optional(),
});
export async function cursorBioPages(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  input: z.input<typeof bioPageCursorInput> = {},
) {
  const parsed = bioPageCursorInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { cursor, limit, search } = parsed.data;
  const and: Document[] = [ownedBy<BioPage>(ctx.workspace, "userId")];
  if (cursor) and.push({ _id: { $lt: new ObjectId(cursor) } });
  if (search) {
    const literal = {
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    and.push({
      $or: [{ title: literal }, { slug: literal }, { handle: literal }],
    });
  }
  // Keep drafts, publication snapshots and complete link arrays out of list reads.
  const rows = await collection(ctx.db, "bio_pages")
    .find<BioPage & { linkCount: number }>(
      { $and: and },
      {
        projection: {
          slug: 1,
          handle: 1,
          title: 1,
          avatarUrl: 1,
          updatedAt: 1,
          createdAt: 1,
          createdBy: 1,
          linkCount: {
            $cond: [
              { $isArray: "$draft.blocks" },
              {
                $reduce: {
                  input: "$draft.blocks",
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $switch: {
                          branches: [
                            {
                              case: { $eq: ["$$this.type", "links"] },
                              then: {
                                $size: { $ifNull: ["$$this.items", []] },
                              },
                            },
                            { case: { $eq: ["$$this.type", "link"] }, then: 1 },
                          ],
                          default: 0,
                        },
                      },
                    ],
                  },
                },
              },
              { $size: { $ifNull: ["$links", []] } },
            ],
          },
        },
      },
    )
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();
  return ok({
    items: rows
      .slice(0, limit)
      .map((page) => ({ ...summary(page), linkCount: page.linkCount })),
    nextCursor: rows.length > limit ? rows[limit - 1]!._id.toHexString() : null,
  });
}

export async function listBioPages(
  ctx: Pick<ServiceContext, "db" | "workspace">,
) {
  const pages = await collection(ctx.db, "bio_pages")
    .find(ownedBy<BioPage>(ctx.workspace, "userId"))
    .sort({ updatedAt: -1, _id: -1 })
    .toArray();
  return pages.map(summary);
}

async function findOwned(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const _id = parseObjectId(id);
  if (!_id) return null;
  return collection(ctx.db, "bio_pages").findOne({
    $and: [{ _id }, ownedBy<BioPage>(ctx.workspace, "userId")],
  });
}

export async function getBioPage(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
): Promise<BioEditable | null> {
  const page = await findOwned(ctx, id);
  if (!page) return null;
  const linkIds = (page.links ?? []).map((item) => item.link);
  const links = await collection(ctx.db, "links")
    .find(
      {
        $and: [
          { _id: { $in: linkIds }, deletedAt: { $exists: false } },
          ownedBy<Link>(ctx.workspace),
        ],
      },
      { projection: { urlCode: 1, key: 1, longUrl: 1, title: 1 } },
    )
    .toArray();
  const byId = new Map(links.map((link) => [link._id.toHexString(), link]));
  const theme = bioThemeSchema.safeParse(page.theme ?? {});
  const shape = str(page.avatarShape);
  return {
    ...summary(page),
    description: str(page.description) ?? "",
    avatarShape: shape === "square" || shape === "rounded" ? shape : "circle",
    theme: theme.success ? theme.data : {},
    socials: (page.socials ?? []).flatMap((item) =>
      item.platform && item.url
        ? [{ platform: item.platform, url: item.url }]
        : [],
    ),
    socialColor: str(page.socialColor) ?? "original",
    links: (page.links ?? []).flatMap((item) => {
      const link = byId.get(item.link.toHexString());
      if (!link) return [];
      return [
        {
          linkId: item.link.toHexString(),
          title: str(item.title) ?? link.title ?? "",
          image: str(item.image) ?? null,
          key: link.urlCode ?? link.key ?? "",
          url: link.longUrl ?? "",
        },
      ];
    }),
  };
}

export const slugPattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

// Slugs become {handle}.shortn.at in P5, so they're held to DNS-label rules
// now and checked against existing handles and aliases as well.
async function checkSlug(ctx: ServiceContext, raw: string) {
  const slug = raw.trim().toLowerCase();
  if (!slugPattern.test(slug) || reservedKeys.has(slug))
    return fail("invalid_slug");
  const [page, alias] = await Promise.all([
    ctx.db
      .collection(physicalNames.bio_pages)
      .findOne(
        { $or: [{ slug }, { handle: slug }] },
        { projection: { _id: 1 } },
      ),
    ctx.db
      .collection(physicalNames.bio_aliases)
      .findOne({ slug }, { projection: { _id: 1 } }),
  ]);
  if (page || alias) return fail("slug_taken");
  return ok(slug);
}

// Live availability for the slug field on /bio/new.
export async function bioSlugStatus(
  ctx: ServiceContext,
  raw: string,
): Promise<"available" | "invalid" | "taken"> {
  const checked = await checkSlug(ctx, raw);
  if (checked.ok) return "available";
  return checked.error === "slug_taken" ? "taken" : "invalid";
}

export const createBioPageInput = z
  .object({
    slug: z.string().min(1).max(63),
    title: z.string().trim().max(120).optional(),
    linkId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
  })
  .strict();

export async function createBioPage(
  ctx: ServiceContext,
  input: {
    slug: string;
    title?: string | undefined;
    linkId?: string | undefined;
  },
): Promise<Result<BioSummary, BioError>> {
  if (!can(ctx.actor, "resource.create")) return fail("forbidden");
  const parsed = createBioPageInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  input = parsed.data;
  if (!validBioHandle(input.slug.trim().toLowerCase()))
    return fail("invalid_slug");
  const checked = await checkSlug(ctx, input.slug);
  if (!checked.ok) return checked;
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const limit = entitlements.limits.bioPages;
  if (limit !== null) {
    const used = await collection(ctx.db, "bio_pages").countDocuments(
      ownedBy<BioPage>(ctx.workspace, "userId"),
    );
    if (used >= limit) return fail("limit_reached", { limit, used });
  }
  const firstLink = input.linkId ? await ownedLink(ctx, input.linkId) : null;
  if (input.linkId && !firstLink) return fail("link_not_found");
  const now = nowOf(ctx);
  const sub = legacySubOf(ctx);
  const doc: Document = {
    _id: new ObjectId(),
    ...(sub ? { userId: sub } : {}),
    slug: checked.value,
    handle: checked.value,
    published: false,
    publicationManaged: true,
    title: input.title?.trim() || checked.value,
    avatarShape: "circle",
    theme: { buttonStyle: "rounded" },
    links: firstLink
      ? [{ link: firstLink._id, title: firstLink.title ?? "", addedAt: now }]
      : [],
    socials: [],
    socialColor: "original",
    workspaceId: ctx.workspace._id,
    createdBy: ctx.actor.userId,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await ctx.db.collection(physicalNames.bio_pages).insertOne(doc);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("slug_taken");
    throw error;
  }
  const created = await collection(ctx.db, "bio_pages").findOne({
    _id: doc._id,
  });
  if (!created) throw new Error("Created bio page vanished");
  return ok(summary(created));
}

async function ownedLink(ctx: ServiceContext, id: string) {
  const _id = parseObjectId(id);
  if (!_id) return null;
  return collection(ctx.db, "links").findOne({
    $and: [
      { _id, deletedAt: { $exists: false } },
      ownedBy<Link>(ctx.workspace),
    ],
  });
}

export async function updateBioPage(
  ctx: ServiceContext,
  id: string,
  patch: unknown,
): Promise<Result<BioSummary, BioError>> {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden");
  const parsed = bioPatchSchema.safeParse(patch);
  if (!parsed.success) return fail("invalid_input");
  const page = await findOwned(ctx, id);
  if (!page) return fail("not_found");
  const $set: Document = { updatedAt: nowOf(ctx) };
  const $unset: Document = {};
  for (const [field, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    if (value === "") $unset[field] = "";
    else $set[field] = value;
  }
  await ctx.db
    .collection(physicalNames.bio_pages)
    .updateOne(
      { _id: page._id },
      { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
    );
  const updated = await collection(ctx.db, "bio_pages").findOne({
    _id: page._id,
  });
  if (!updated) return fail("not_found");
  return ok(summary(updated));
}

// Replaces the ordered link list: covers add, remove, reorder and per-link
// title/image edits in one write.
export async function setBioLinks(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<Result<BioSummary, BioError>> {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden");
  const parsed = bioLinksSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const page = await findOwned(ctx, id);
  if (!page) return fail("not_found");
  const ids = parsed.data.flatMap((item) => parseObjectId(item.linkId) ?? []);
  if (ids.length !== parsed.data.length) return fail("link_not_found");
  const owned = await collection(ctx.db, "links")
    .find(
      {
        $and: [
          { _id: { $in: ids }, deletedAt: { $exists: false } },
          ownedBy<Link>(ctx.workspace),
        ],
      },
      { projection: { _id: 1 } },
    )
    .toArray();
  if (
    new Set(owned.map((link) => link._id.toHexString())).size !==
    new Set(ids.map(String)).size
  )
    return fail("link_not_found");
  const previous = new Map(
    (page.links ?? []).map((item) => [item.link.toHexString(), item]),
  );
  const now = nowOf(ctx);
  const links = parsed.data.map((item) => {
    const before = previous.get(item.linkId);
    const addedAt: unknown = before
      ? Reflect.get(before, "addedAt")
      : undefined;
    return {
      link: new ObjectId(item.linkId),
      ...(item.title ? { title: item.title } : {}),
      ...(item.image ? { image: item.image } : {}),
      addedAt: addedAt instanceof Date ? addedAt : now,
    };
  });
  await ctx.db
    .collection(physicalNames.bio_pages)
    .updateOne({ _id: page._id }, { $set: { links, updatedAt: now } });
  const updated = await collection(ctx.db, "bio_pages").findOne({
    _id: page._id,
  });
  if (!updated) return fail("not_found");
  return ok(summary(updated));
}

export async function deleteBioPage(
  ctx: ServiceContext,
  id: string,
): Promise<Result<{ slug: string }, BioError>> {
  const page = await findOwned(ctx, id);
  if (!page) return fail("not_found");
  const createdBy =
    typeof page.createdBy === "string" ? page.createdBy : undefined;
  if (!can(ctx.actor, "resource.delete", { createdBy }))
    return fail("forbidden");
  await ctx.db.collection(physicalNames.bio_pages).deleteOne({ _id: page._id });
  return ok({ slug: page.slug ?? "" });
}
