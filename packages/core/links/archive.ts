import { collection, type Documents } from "@shortn/db";
import { ObjectId, type Document } from "mongodb";
import { bulkLinkTagsSchema } from "./bulk-tags";
import { can } from "../workspaces/authz";
import { ownedBy } from "../workspaces/service";
import { nowOf, type ServiceContext } from "../workspaces/context";
import {
  linkEventData,
  recordWebhookEvents,
  withMutation,
} from "../webhooks/events";
import { fail, ok } from "../result";

/** Archive is library organization: redirects and resource associations stay intact. */
export async function setLinksArchived(
  ctx: ServiceContext,
  rawIds: string[],
  archived: boolean,
) {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden" as const);
  const parsed = bulkLinkTagsSchema.shape.ids.safeParse(rawIds);
  if (!parsed.success || typeof archived !== "boolean")
    return fail("invalid_input" as const);
  const ids = [...new Set(parsed.data)].map((id) => new ObjectId(id));
  return withMutation(ctx.db, async (session) => {
    // Even a no-op takes the fence: inverse operations over mixed states must
    // retry against the same workspace snapshot instead of writing disjoint rows.
    await collection(ctx.db, "workspaces").updateOne(
      { _id: ctx.workspace._id },
      { $inc: { archiveMutationRevision: 1 } },
      { session },
    );
    const links = collection(ctx.db, "links");
    const selected = await links
      .find(
        {
          $and: [
            ownedBy<Documents["links"]>(ctx.workspace),
            {
              _id: { $in: ids },
              deletedAt: { $exists: false },
              purgingAt: { $exists: false },
              hidden: { $ne: true },
              isQrCode: { $ne: true },
            },
          ],
        },
        { session },
      )
      .toArray();
    if (selected.length !== ids.length) return fail("not_found" as const);
    const now = nowOf(ctx),
      changed = selected.filter(
        (link) => Boolean(link.archivedAt) !== archived,
      );
    if (changed.length) {
      const update: Document = archived
        ? {
            $set: { archivedAt: now, updatedAt: now },
            $inc: { "_sync.rev": 1 },
          }
        : {
            $unset: { archivedAt: "" },
            $set: { updatedAt: now },
            $inc: { "_sync.rev": 1 },
          };
      await links.updateMany(
        { _id: { $in: changed.map((link) => link._id) } },
        update,
        { session },
      );
      await recordWebhookEvents(
        ctx.db,
        ctx.workspace._id,
        changed.map((link) => ({
          type: "link.updated",
          data: {
            ...linkEventData(link, ctx.linkDomain),
            archivedAt: archived ? now.toISOString() : null,
          },
        })),
        session,
        now,
      );
    }
    // archivedAt is absent from redirect payloads; neither cache eviction nor recompilation is needed.
    return ok({ selected: ids.length, updated: changed.length });
  });
}
