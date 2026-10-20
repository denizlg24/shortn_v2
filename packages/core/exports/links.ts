import { z } from "zod";
import { ObjectId, type Sort } from "mongodb";
import { collection } from "@shortn/db";
import { loadEntitlements, hasFeature } from "@shortn/billing";
import type { ServiceContext } from "../workspaces/context";
import { can } from "../workspaces/authz";
import { linkListFilter, toLinkView } from "../links/service";
import {
  linkDomainFilter,
  linkSorts,
  linkStatuses,
  tagMatchModes,
} from "../links/filters";
import {
  encodeLinkExport,
  exportedLink,
  type ExportedLink,
  type LinkExportFormat,
} from "./link-format";

export const linkExportFilterSchema = z
  .object({
    search: z.string().max(200).optional(),
    tags: z.array(z.string().min(1).max(64)).max(50).optional(),
    tagMode: z.enum(tagMatchModes).optional(),
    untagged: z.boolean().optional(),
    domain: z
      .string()
      .max(253)
      .refine((value) => linkDomainFilter(value) === value)
      .optional(),
    campaign: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    status: z.enum(linkStatuses).optional(),
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    trash: z.boolean().optional(),
    archived: z.boolean().optional(),
    sort: z.enum(linkSorts).optional(),
  })
  .strict();
export type LinkExportFilter = z.output<typeof linkExportFilterSchema>;
export class LinkExportError extends Error {
  constructor(
    readonly code:
      "invalid_export" | "forbidden" | "feature_required" | "export_cancelled",
  ) {
    super(code);
  }
}
export async function authorizeLinkExport(
  ctx: ServiceContext,
  campaign = false,
) {
  const [workspace, member, entitlements] = await Promise.all([
    collection(ctx.db, "workspaces").findOne({ _id: ctx.workspace._id }),
    collection(ctx.db, "workspace_members").findOne({
      workspaceId: ctx.workspace._id,
      userId: ctx.actor.userId,
    }),
    loadEntitlements(ctx.db, ctx.workspace._id),
  ]);
  if (
    !workspace ||
    !member ||
    !can({ userId: member.userId, role: member.role }, "workspace.view")
  )
    throw new LinkExportError("forbidden");
  if (
    !hasFeature(entitlements, "csvExport") ||
    (campaign && !hasFeature(entitlements, "campaignExport"))
  )
    throw new LinkExportError("feature_required");
  return workspace;
}
export async function countFilteredLinkExport(
  ctx: ServiceContext,
  input: unknown = {},
) {
  const parsed = linkExportFilterSchema.safeParse(input);
  if (!parsed.success) throw new LinkExportError("invalid_export");
  const workspace = await authorizeLinkExport(
      ctx,
      Boolean(parsed.data.campaign),
    ),
    filter = await linkListFilter({ ...ctx, workspace }, parsed.data);
  return collection(ctx.db, "links").countDocuments(filter);
}
/** Server/worker iterator: snapshot reads avoid duplicates when fields change mid-export. */
async function* records(
  ctx: ServiceContext,
  input: LinkExportFilter,
  signal?: AbortSignal,
  selection?: string[],
  onRows?: (done: number) => Promise<void>,
): AsyncGenerator<ExportedLink> {
  const workspace = await authorizeLinkExport(ctx, Boolean(input.campaign)),
    filter = await linkListFilter({ ...ctx, workspace }, input);
  if (selection) filter._id = { $in: selection.map((id) => new ObjectId(id)) };
  const session = ctx.db.client.startSession({ snapshot: true });
  const sort: Sort =
    input.sort === "oldest"
      ? { date: 1 as const, _id: 1 as const }
      : input.sort === "clicks"
        ? { "clicks.total": -1 as const, _id: -1 as const }
        : { date: -1 as const, _id: -1 as const };
  const cursor = collection(ctx.db, "links")
    .find(filter, {
      session,
      projection: {
        _id: 1,
        urlCode: 1,
        key: 1,
        longUrl: 1,
        destination: 1,
        title: 1,
        tags: 1,
        domain: 1,
        rules: 1,
        createdAt: 1,
        date: 1,
        clicks: 1,
        stats: 1,
      },
    })
    .sort(sort)
    .batchSize(500);
  let done = 0;
  try {
    for await (const doc of cursor) {
      if (signal?.aborted) throw new LinkExportError("export_cancelled");
      // Authorization is intentionally outside the snapshot session.
      if (done % 500 === 0)
        await authorizeLinkExport(ctx, Boolean(input.campaign));
      yield exportedLink(toLinkView(doc, ctx.linkDomain));
      done++;
      if (done % 500 === 0) await onRows?.(done);
    }
    if (done % 500 !== 0 || done === 0) await onRows?.(done);
  } finally {
    await cursor.close();
    await session.endSession();
  }
}
export async function* streamFilteredLinkExport(
  ctx: ServiceContext,
  input: unknown,
  format: LinkExportFormat,
  signal?: AbortSignal,
  selection?: string[],
  onRows?: (done: number) => Promise<void>,
) {
  const parsed = linkExportFilterSchema.safeParse(input);
  if (!parsed.success || !["csv", "json"].includes(format))
    throw new LinkExportError("invalid_export");
  if (
    selection &&
    (selection.length >= 5000 ||
      selection.some((id) => !/^[a-f\d]{24}$/i.test(id)))
  )
    throw new LinkExportError("invalid_export");
  await authorizeLinkExport(ctx, Boolean(parsed.data.campaign));
  if (signal?.aborted) throw new LinkExportError("export_cancelled");
  yield* encodeLinkExport(
    records(ctx, parsed.data, signal, selection, onRows),
    format,
  );
}
