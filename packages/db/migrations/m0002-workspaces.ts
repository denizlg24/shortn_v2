import { ObjectId } from "mongodb";
import type { AnyBulkWriteOperation, Document } from "mongodb";
import {
  existing,
  linkDomain,
  names,
  oid,
  orphanWorkspaceSlug,
  report,
  str,
  workspaceMaps,
} from "./helpers";
import type { Migration, MigrationContext } from "./runner";

const createdBy = "migration:0002-workspaces";

function slugFor(user: Document): string {
  const source =
    str(user.username) ??
    str(user.name) ??
    str(user.email)?.split("@")[0] ??
    "workspace";
  const base =
    source
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace";
  return `${base}-${String(user._id).slice(-6)}`;
}

// Owned by `sub` (BioPage.userId also stores the sub, bioPageActions.ts:42).
const bySubCollections = [
  [names.links, "sub"],
  [names.qr_codes, "sub"],
  [names.campaigns, "sub"],
  [names.tags, "sub"],
  [names.bio_pages, "userId"],
] as const;

async function assign(
  ctx: MigrationContext,
  collection: string,
  resolve: (doc: Document) => ObjectId | undefined,
) {
  await ctx.batch({
    name: collection,
    filter: { workspaceId: { $exists: false } },
    operations: (docs) =>
      docs.flatMap((doc): AnyBulkWriteOperation<Document>[] => {
        const workspaceId = resolve(doc);
        return workspaceId
          ? [
              {
                updateOne: {
                  filter: { _id: doc._id, workspaceId: { $exists: false } },
                  update: { $set: { workspaceId } },
                },
              },
            ]
          : [];
      }),
  });
}

export const workspaces: Migration = {
  id: "0002-workspaces",
  phase: "expand",
  continuous: true,
  async up(ctx) {
    const now = new Date();
    await ctx.batch({
      name: names.user,
      target: names.workspaces,
      checkpointId: "user__workspaces",
      operations: (users) => [
        {
          updateOne: {
            filter: { slug: orphanWorkspaceSlug },
            update: {
              $setOnInsert: {
                slug: orphanWorkspaceSlug,
                name: "Orphaned legacy data",
                ownerUserId: "system",
                personal: false,
                plan: "free",
                addOns: [],
                defaultDomain: linkDomain,
                createdAt: now,
                updatedAt: now,
                createdBy,
              },
            },
            upsert: true,
          },
        },
        ...users.map((user) => ({
          updateOne: {
            filter: { ownerUserId: String(user._id), personal: true },
            update: {
              $setOnInsert: {
                slug: slugFor(user),
                name: str(user.name) ?? str(user.username) ?? "Personal",
                ownerUserId: String(user._id),
                personal: true,
                plan: "free",
                addOns: [],
                defaultDomain: linkDomain,
                ...(str(user.sub) ? { legacySub: str(user.sub) } : {}),
                createdAt: now,
                updatedAt: now,
                createdBy,
              },
            },
            upsert: true,
          },
        })),
      ],
    });
    const maps = await workspaceMaps(ctx);
    // A dry run wrote nothing, so the upserted workspaces don't exist yet.
    const orphan = maps.orphan ?? (ctx.dryRun ? new ObjectId() : undefined);
    if (!orphan) throw new Error("Orphan workspace missing after upsert");
    await ctx.batch({
      name: names.user,
      target: names.workspace_members,
      checkpointId: "user__workspace_members",
      operations: (users) =>
        users.flatMap((user) => {
          const workspaceId = maps.byUserId.get(String(user._id));
          return workspaceId
            ? [
                {
                  updateOne: {
                    filter: { workspaceId, userId: String(user._id) },
                    update: {
                      $setOnInsert: {
                        workspaceId,
                        userId: String(user._id),
                        role: "owner",
                        createdAt: now,
                        updatedAt: now,
                        createdBy,
                      },
                    },
                    upsert: true,
                  },
                },
              ]
            : [];
        }),
    });
    const present = new Set(
      await existing(ctx, [
        ...bySubCollections.map(([name]) => name),
        names.link_reports,
        names.scheduled_changes,
      ]),
    );
    for (const [collection, field] of bySubCollections)
      if (present.has(collection))
        await assign(ctx, collection, (doc) => {
          const sub = str(doc[field]);
          return (sub && maps.bySub.get(sub)) || orphan;
        });
    if (present.has(names.link_reports)) {
      const links = await ctx
        .read(names.links)
        .find(
          { workspaceId: { $exists: true } },
          { projection: { urlCode: 1, workspaceId: 1 } },
        )
        .toArray();
      const byCode = new Map(
        links.flatMap((link) => {
          const code = str(link.urlCode);
          const workspaceId = oid(link.workspaceId);
          return code && workspaceId ? [[code, workspaceId] as const] : [];
        }),
      );
      // A report for a deleted link stays unassigned until it can be matched.
      await assign(ctx, names.link_reports, (doc) =>
        byCode.get(str(doc.urlCode) ?? ""),
      );
    }
    if (present.has(names.scheduled_changes))
      await assign(ctx, names.scheduled_changes, (doc) => {
        const userId = str(doc.userId);
        return (userId && maps.byUserId.get(userId)) || orphan;
      });
  },
  async verify(ctx) {
    const counts: Record<string, number> = {};
    const discrepancies: string[] = [];
    const up = ctx.direction === "up";
    const present = await existing(ctx, [
      ...bySubCollections.map(([name]) => name),
      names.scheduled_changes,
    ]);
    for (const collection of present) {
      const missing = await ctx
        .read(collection)
        .countDocuments({ workspaceId: { $exists: !up } });
      counts[`${collection}.${up ? "missingWorkspace" : "withWorkspace"}`] =
        missing;
      if (missing)
        discrepancies.push(
          `${collection}: ${missing} documents not ${up ? "assigned" : "reverted"}`,
        );
    }
    if (!up) {
      const created = (await ctx.exists(names.workspaces))
        ? await ctx.read(names.workspaces).countDocuments({ createdBy })
        : 0;
      if (created) discrepancies.push(`${created} migration workspaces remain`);
      return report(counts, discrepancies);
    }
    const users = await ctx
      .read(names.user)
      .find({}, { projection: { sub: 1 } })
      .toArray();
    const subs = new Set(users.flatMap((user) => str(user.sub) ?? []));
    const maps = await workspaceMaps(ctx);
    counts.users = users.length;
    counts.personalWorkspaces = maps.byUserId.size;
    if (maps.byUserId.size < users.length)
      discrepancies.push(
        `${users.length - maps.byUserId.size} users without a personal workspace`,
      );
    let expectedOrphans = 0;
    let actualOrphans = 0;
    for (const [collection, field] of bySubCollections) {
      if (!present.includes(collection)) continue;
      const owners = await ctx
        .read(collection)
        .aggregate<{ _id: string | null; n: number }>([
          { $group: { _id: `$${field}`, n: { $sum: 1 } } },
        ])
        .toArray();
      for (const owner of owners) {
        const sub = owner._id ?? "";
        if (!subs.has(sub)) {
          expectedOrphans += owner.n;
          continue;
        }
        const workspaceId = maps.bySub.get(sub);
        const assigned = workspaceId
          ? await ctx
              .read(collection)
              .countDocuments({ [field]: sub, workspaceId })
          : 0;
        if (assigned !== owner.n)
          discrepancies.push(
            `${collection}: owner ${sub} has ${owner.n} docs, ${assigned} in its workspace`,
          );
      }
      if (maps.orphan)
        actualOrphans += await ctx
          .read(collection)
          .countDocuments({ workspaceId: maps.orphan });
    }
    counts.expectedOrphans = expectedOrphans;
    counts.orphanWorkspaceDocs = actualOrphans;
    if (expectedOrphans !== actualOrphans)
      discrepancies.push(
        `orphan workspace holds ${actualOrphans}, expected ${expectedOrphans}`,
      );
    return report(counts, discrepancies);
  },
  async down(ctx) {
    const present = await existing(ctx, [
      ...bySubCollections.map(([name]) => name),
      names.link_reports,
      names.scheduled_changes,
    ]);
    for (const collection of present)
      await ctx.batch({
        name: collection,
        filter: { workspaceId: { $exists: true } },
        operations: (docs) =>
          docs.map((doc) => ({
            updateOne: {
              filter: { _id: doc._id },
              update: { $unset: { workspaceId: "" } },
            },
          })),
      });
    for (const collection of [names.workspace_members, names.workspaces])
      if (await ctx.exists(collection))
        await ctx.batch({
          name: collection,
          filter: { createdBy },
          operations: (docs) =>
            docs.map((doc) => ({ deleteOne: { filter: { _id: doc._id } } })),
        });
  },
};
