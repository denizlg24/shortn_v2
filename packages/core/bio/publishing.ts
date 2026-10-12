import { loadEntitlements } from "@shortn/billing";
import { collection, physicalNames } from "@shortn/db";
import { ObjectId, type Db, type Document } from "mongodb";
import { can } from "../workspaces/authz";
import { ownedBy, parseObjectId } from "../workspaces/service";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { createLink } from "../links/service";
import { fail, ok } from "../result";
import {
  accessibleBioTheme,
  bioLinkIds,
  bioContentSchema,
  migratedBioContent,
  type BioContent,
  type PublicBio,
} from "./content";
import { bioCanonical, validBioHandle } from "./hosts";

export const bioVersionsCollection = physicalNames.bio_page_versions;
export const bioOutboxCollection = physicalNames.bio_delivery_jobs;
const pages = (db: Db) => db.collection(physicalNames.bio_pages);
export async function ownedBioDocument(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const _id = parseObjectId(id);
  if (!_id) return null;
  return pages(ctx.db).findOne({
    $and: [{ _id }, ownedBy(ctx.workspace, "userId")],
  });
}
export async function readBioDraft(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const page = await ownedBioDocument(ctx, id);
  if (!page) return null;
  const parsed = bioContentSchema.safeParse(page.draft);
  return {
    id,
    handle: String(page.handle ?? page.slug),
    revision: Number(page.draftRevision ?? 0),
    publishedRevision: Number(page.publishedRevision ?? 0),
    content: parsed.success ? parsed.data : migratedBioContent(page),
  };
}
async function validateContent(ctx: ServiceContext, input: unknown) {
  const result = bioContentSchema.safeParse(input);
  if (!result.success) return fail("invalid_input" as const);
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  if (
    entitlements.plan === "free" &&
    (result.data.hideBranding ||
      result.data.blocks.some(
        (b) =>
          b.schedule ||
          (b.type === "links" && b.items.some((i) => i.schedule)) ||
          (b.type === "profile" && b.paidBadge),
      ))
  )
    return fail("feature_required" as const);
  const ids = bioLinkIds(result.data).map((id) => new ObjectId(id));
  const count = await collection(ctx.db, "links").countDocuments({
    $and: [{ _id: { $in: ids } }, ownedBy(ctx.workspace, "sub")],
  });
  if (count !== ids.length) return fail("link_not_found" as const);
  return ok({ ...result.data, theme: accessibleBioTheme(result.data.theme) });
}
export async function saveBioDraft(
  ctx: ServiceContext,
  id: string,
  revision: number,
  input: unknown,
) {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden" as const);
  const page = await ownedBioDocument(ctx, id);
  if (!page) return fail("not_found" as const);
  const checked = await validateContent(ctx, input);
  if (!checked.ok) return checked;
  const match =
    revision === 0
      ? { $or: [{ draftRevision: 0 }, { draftRevision: { $exists: false } }] }
      : { draftRevision: revision };
  const updated = await pages(ctx.db).updateOne(
    { _id: page._id, ...match },
    {
      $set: {
        draft: checked.value,
        publicationManaged: true,
        updatedAt: nowOf(ctx),
      },
      $inc: { draftRevision: 1 },
    },
  );
  return updated.modifiedCount
    ? ok({ revision: revision + 1 })
    : fail("conflict" as const);
}
export async function publishBioDraft(
  ctx: ServiceContext,
  id: string,
  revision: number,
) {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden" as const);
  const page = await ownedBioDocument(ctx, id);
  if (!page) return fail("not_found" as const);
  if (Number(page.draftRevision ?? 0) !== revision)
    return fail("conflict" as const);
  const checked = await validateContent(
    ctx,
    page.draft ?? migratedBioContent(page),
  );
  if (!checked.ok) return checked;
  const now = nowOf(ctx);
  const session = ctx.db.client.startSession();
  try {
    await session.withTransaction(async () => {
      const match =
        revision === 0
          ? {
              $or: [
                { draftRevision: 0 },
                { draftRevision: { $exists: false } },
              ],
            }
          : { draftRevision: revision };
      const updated = await pages(ctx.db).updateOne(
        { _id: page._id, ...match },
        {
          $set: {
            publishedContent: checked.value,
            published: true,
            publishedRevision: revision,
            publicationManaged: true,
            updatedAt: now,
          },
        },
        { session },
      );
      if (!updated.matchedCount) throw new Error("bio_conflict");
      await ctx.db
        .collection(bioVersionsCollection)
        .updateOne(
          { bioPageId: page._id, revision },
          {
            $setOnInsert: {
              workspaceId: ctx.workspace._id,
              content: checked.value,
              createdAt: now,
              createdBy: ctx.actor.userId,
            },
          },
          { upsert: true, session },
        );
      const versions = await ctx.db
        .collection(bioVersionsCollection)
        .find({ bioPageId: page._id }, { session })
        .sort({ createdAt: -1, revision: -1 })
        .skip(20)
        .toArray();
      if (versions.length)
        await ctx.db
          .collection(bioVersionsCollection)
          .deleteMany(
            { _id: { $in: versions.map((v) => v._id) } },
            { session },
          );
      await ctx.db
        .collection(bioOutboxCollection)
        .updateOne(
          { bioPageId: page._id },
          { $set: { nextAttemptAt: now, attempts: 0, updatedAt: now } },
          { upsert: true, session },
        );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "bio_conflict")
      return fail("conflict" as const);
    throw error;
  } finally {
    await session.endSession();
  }
  return ok({ revision });
}
export async function bioVersions(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const page = await ownedBioDocument(ctx, id);
  if (!page) return [];
  const versions = await ctx.db
    .collection(bioVersionsCollection)
    .find({ bioPageId: page._id, workspaceId: ctx.workspace._id })
    .sort({ createdAt: -1, revision: -1 })
    .limit(20)
    .toArray();
  return versions.map((v) => ({
    revision: Number(v.revision),
    createdAt: (v.createdAt as Date).toISOString(),
  }));
}
export async function restoreBioVersion(
  ctx: ServiceContext,
  id: string,
  revision: number,
  version: number,
) {
  const page = await ownedBioDocument(ctx, id);
  if (!page) return fail("not_found" as const);
  const saved = await ctx.db
    .collection(bioVersionsCollection)
    .findOne({
      bioPageId: page._id,
      workspaceId: ctx.workspace._id,
      revision: version,
    });
  if (!saved) return fail("not_found" as const);
  return saveBioDraft(ctx, id, revision, saved.content);
}
export async function shortenBioUrl(
  ctx: ServiceContext,
  id: string,
  url: string,
  title: string,
) {
  if (!(await ownedBioDocument(ctx, id))) return fail("not_found" as const);
  const created = await createLink(ctx, { url, title });
  if (created.ok)
    await collection(ctx.db, "links").updateOne(
      { _id: new ObjectId(created.value.id) },
      { $set: { bioPageId: new ObjectId(id), hidden: true } },
    );
  return created;
}
export async function changeBioHandle(
  ctx: ServiceContext,
  id: string,
  handle: string,
) {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden" as const);
  if (!validBioHandle(handle)) return fail("invalid_handle" as const);
  const page = await ownedBioDocument(ctx, id);
  if (!page) return fail("not_found" as const);
  if (page.handle === handle) return ok({ handle });
  if (
    (await pages(ctx.db).findOne({ handle })) ||
    (await collection(ctx.db, "bio_aliases").findOne({ slug: handle }))
  )
    return fail("handle_taken" as const);
  const session = ctx.db.client.startSession();
  try {
    await session.withTransaction(async () => {
      if (page.handle)
        await collection(ctx.db, "bio_aliases").updateOne(
          { slug: page.handle },
          {
            $setOnInsert: {
              slug: page.handle,
              bioPageId: page._id,
              kind: "handle",
              createdAt: nowOf(ctx),
              expiresAt: new Date(nowOf(ctx).getTime() + 30 * 86400000),
              retired: true,
            },
          },
          { upsert: true, session },
        );
      const changed = await pages(ctx.db).updateOne(
        { _id: page._id, handle: page.handle },
        { $set: { handle } },
        { session },
      );
      if (!changed.matchedCount) throw new Error("bio_conflict");
      await ctx.db
        .collection(bioOutboxCollection)
        .updateOne(
          { bioPageId: page._id },
          {
            $set: {
              nextAttemptAt: nowOf(ctx),
              attempts: 0,
              oldHandle: page.handle,
            },
          },
          { upsert: true, session },
        );
    });
  } catch (error) {
    if (error instanceof Error && error.message === "bio_conflict")
      return fail("conflict" as const);
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("handle_taken" as const);
    throw error;
  } finally {
    await session.endSession();
  }
  // Aliases stay retired conservatively until a traffic-based release job is approved.
  return ok({ handle });
}
export async function resolveBioDocument(db: Db, handle: string) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(handle)) return null;
  const current = await pages(db).findOne({ handle, published: true });
  if (current) return current;
  const alias = await collection(db, "bio_aliases").findOne({ slug: handle });
  return alias
    ? pages(db).findOne({ _id: alias.bioPageId, published: true })
    : null;
}
export async function resolveLegacyBio(db: Db, slug: string) {
  const alias = await collection(db, "bio_aliases").findOne({ slug });
  return pages(db).findOne({
    ...(alias
      ? { _id: alias.bioPageId }
      : { $or: [{ legacySlug: slug }, { slug }] }),
    published: true,
  });
}
export async function publicBioFromDocument(
  db: Db,
  page: Document,
  rootOrigin: string,
  subdomains: boolean,
): Promise<PublicBio> {
  const parsed = bioContentSchema.safeParse(page.publishedContent);
  const content: BioContent = parsed.success
    ? parsed.data
    : migratedBioContent(page);
  if (
    page.workspaceId &&
    (await loadEntitlements(db, page.workspaceId)).plan === "free"
  ) {
    content.hideBranding = false;
    content.blocks = content.blocks.map((block) =>
      block.type === "profile" ? { ...block, paidBadge: false } : block,
    );
  }
  const ids = bioLinkIds(content).map((id) => new ObjectId(id));
  const links = await collection(db, "links")
    .find({
      _id: { $in: ids },
      ...(page.workspaceId
        ? { workspaceId: page.workspaceId }
        : { sub: page.userId }),
    })
    .toArray();
  const domain = page.customDomain
    ? await (
        await import("../domains/service")
      ).activeDomain(db, String(page.customDomain))
    : null;
  return {
    id: String(page._id),
    handle: String(page.handle ?? page.slug),
    revision: Number(page.publishedRevision ?? 0),
    canonical: bioCanonical(
      String(page.handle ?? page.slug),
      rootOrigin,
      subdomains,
      domain?.hostname,
    ),
    content,
    links: Object.fromEntries(
      links.flatMap((link) => {
        if (link.domainInactive === true) return [];
        const origin =
          link.domain && link.domain !== new URL(rootOrigin).host
            ? `${new URL(rootOrigin).protocol}//${link.domain}`
            : rootOrigin;
        const href = new URL(
          `/${encodeURIComponent(link.key ?? link.urlCode ?? "")}`,
          origin,
        );
        href.searchParams.set("ref", `bio:${page._id}`);
        return [
          [
            String(link._id),
            {
              href: href.href,
              title: link.title ?? link.key ?? link.urlCode ?? "",
            },
          ],
        ];
      }),
    ),
  };
}
