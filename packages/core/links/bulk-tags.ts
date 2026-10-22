import { collection, type Documents } from "@shortn/db";
import { ObjectId, type Sort, type Document } from "mongodb";
import { z } from "zod";
import { can } from "../workspaces/authz";
import { ownedBy } from "../workspaces/service";
import { legacySubOf, nowOf, type ServiceContext } from "../workspaces/context";
import {
  embeddedTags,
  ensureTags,
  normalizeTagName,
  tagName,
} from "../tags/service";
import {
  withMutation,
  recordWebhookEvents,
  linkEventData,
} from "../webhooks/events";
import { fail, ok, type Result } from "../result";
import { isTakenDown } from "./moderation";

export const bulkLinkLimit = 500;
export const bulkTagLimit = 50;
export const bulkLinkTagsSchema = z
  .object({
    ids: z
      .array(z.string().regex(/^[a-f\d]{24}$/))
      .min(1)
      .max(bulkLinkLimit),
    mode: z.enum(["add", "remove", "replace"]),
    tags: z.array(z.string().trim().min(1).max(48)).max(bulkTagLimit),
  })
  .strict()
  .refine((input) => input.mode === "replace" || input.tags.length > 0);
export type BulkLinkTagsInput = z.infer<typeof bulkLinkTagsSchema>;
export type BulkLinkTagsError =
  "forbidden" | "invalid_input" | "not_found" | "tag_limit" | "taken_down";

/** One bounded transaction: stale/foreign selections and tag overflow change nothing. */
export async function bulkLinkTags(
  ctx: ServiceContext,
  raw: BulkLinkTagsInput,
): Promise<Result<{ selected: number; updated: number }, BulkLinkTagsError>> {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden");
  const parsed = bulkLinkTagsSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_input");
  const { mode } = parsed.data,
    ids = [...new Set(parsed.data.ids)].map((id) => new ObjectId(id));
  const names = [
    ...new Map(
      parsed.data.tags.map((value) => {
        const name = normalizeTagName(value);
        return [name.toLowerCase(), name];
      }),
    ).values(),
  ];
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  return withMutation(ctx.db, async (session) => {
    const links = await collection(ctx.db, "links")
      .find(
        {
          $and: [
            ownedBy<Documents["links"]>(ctx.workspace),
            {
              _id: { $in: ids },
              deletedAt: { $exists: false },
              isQrCode: { $ne: true },
              hidden: { $ne: true },
            },
          ],
        },
        { session },
      )
      .toArray();
    if (links.length !== ids.length) return fail("not_found");
    if (links.some(isTakenDown)) return fail("taken_down");
    const changes = links.map((link) => {
      const existing = new Map(
        (link.tags ?? [])
          .filter((tag) => tagName(tag))
          .map((tag) => [tagName(tag).toLowerCase(), tag]),
      );
      const nextNames =
        mode === "replace"
          ? names
          : mode === "add"
            ? [...new Set([...existing.keys(), ...wanted])]
            : [...existing.keys()].filter((name) => !wanted.has(name));
      return { link, existing, nextNames };
    });
    // Validate the complete operation before creating tags or writing any links.
    if (changes.some((change) => change.nextNames.length > bulkTagLimit))
      return fail("tag_limit");
    const refs = mode === "remove" ? [] : await ensureTags(ctx, names, session);
    const canonical = new Map(
      embeddedTags(refs, legacySubOf(ctx)).map((tag) => [
        tagName(tag).toLowerCase(),
        tag,
      ]),
    );
    const now = nowOf(ctx),
      changed: Documents["links"][] = [];
    for (const { link, existing, nextNames } of changes) {
      const tags = nextNames.map(
        (name) =>
          canonical.get(name.toLowerCase()) ??
          existing.get(name.toLowerCase())!,
      );
      const tagIds = [
        ...new Map(
          tags.flatMap((tag) =>
            tag._id ? [[String(tag._id), tag._id] as const] : [],
          ),
        ).values(),
      ];
      const identity = (values: typeof tags) =>
        values.map((tag) => [
          String(tag._id ?? ""),
          tag.id ?? "",
          tagName(tag),
        ]);
      if (
        JSON.stringify(identity(tags)) ===
          JSON.stringify(identity(link.tags ?? [])) &&
        JSON.stringify(tagIds.map(String)) ===
          JSON.stringify((link.tagIds ?? []).map(String))
      )
        continue;
      const update: Document = {
        $set: { tags, tagIds, updatedAt: now },
        $inc: { "_sync.rev": 1 },
      };
      await collection(ctx.db, "links").updateOne({ _id: link._id }, update, {
        session,
      });
      changed.push({ ...link, tags, tagIds, updatedAt: now });
    }
    await recordWebhookEvents(
      ctx.db,
      ctx.workspace._id,
      changed.map((link) => ({
        type: "link.updated",
        data: linkEventData(link, ctx.linkDomain),
      })),
      session,
      now,
    );
    // Tags are management metadata, absent from redirect payloads; no redirect invalidation is needed.
    return ok({ selected: ids.length, updated: changed.length });
  });
}

/** Filter and paginate the fixed selection on the server; never return its whole library. */
export async function pageBulkTagLinks(
  ctx: ServiceContext,
  ids: string[],
  input: import("./service").ListLinksInput = {},
) {
  if (
    !can(ctx.actor, "resource.update") ||
    !bulkLinkTagsSchema.shape.ids.safeParse(ids).success
  )
    return null;
  const { linkListFilter, toLinkView } = await import("./service");
  const scope = {
    $and: [
      ownedBy<Documents["links"]>(ctx.workspace),
      {
        _id: { $in: [...new Set(ids)].map((id) => new ObjectId(id)) },
        deletedAt: { $exists: false },
        hidden: { $ne: true },
        isQrCode: { $ne: true },
        ...(!input.includeArchived
          ? { archivedAt: { $exists: input.archived === true } }
          : {}),
      },
    ],
  };
  const filter = {
    $and: [
      scope,
      await linkListFilter(ctx, {
        ...input,
        trash: false,
        includeHidden: false,
      }),
    ],
  };
  const links = collection(ctx.db, "links");
  const [selected, total] = await Promise.all([
    links.countDocuments(scope),
    links.countDocuments(filter),
  ]);
  const pages = Math.max(1, Math.ceil(total / 25)),
    page = Math.max(
      1,
      Math.min(pages, Number.isSafeInteger(input.page) ? input.page! : 1),
    );
  const order: Sort =
    input.sort === "oldest"
      ? { date: 1 as const, _id: 1 as const }
      : input.sort === "clicks"
        ? { "clicks.total": -1 as const, _id: -1 as const }
        : { date: -1 as const, _id: -1 as const };
  const rows = await links
    .find(filter)
    .sort(order)
    .skip((page - 1) * 25)
    .limit(25)
    .toArray();
  return {
    selected,
    total,
    page,
    pages,
    items: rows.map((link) => toLinkView(link, ctx.linkDomain)),
  };
}
