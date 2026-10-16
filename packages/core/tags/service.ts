import { collection, physicalNames, type Documents } from "@shortn/db";
import { nanoid } from "nanoid";
import { ObjectId, type ClientSession, type Filter } from "mongodb";
import { legacySubOf, nowOf, type ServiceContext } from "../workspaces/context";
import { ownedBy, parseObjectId } from "../workspaces/service";
import { can } from "../workspaces/authz";
import { endpoints } from "../webhooks/service";
import { recordWebhookEvent, linkEventData } from "../webhooks/events";
import { fail, ok, type Result } from "../result";

type Tag = Documents["tags"];

export interface TagRef {
  _id: ObjectId;
  id: string;
  name: string;
}

export const tagName = (tag: Pick<Tag, "name" | "tagName">) =>
  (tag.name ?? tag.tagName ?? "").trim();

export const normalizeTagName = (name: string) =>
  name.trim().replace(/\s+/g, " ").slice(0, 48);

export async function listTags(ctx: Pick<ServiceContext, "db" | "workspace">) {
  const tags = await collection(ctx.db, "tags")
    .find(ownedBy<Tag>(ctx.workspace), {
      projection: { name: 1, tagName: 1, mergedInto: 1 },
    })
    .toArray();
  const byLower = new Map<string, { id: string; name: string }>();
  for (const tag of tags) {
    if (tag.mergedInto) continue;
    const name = tagName(tag);
    if (name && !byLower.has(name.toLowerCase()))
      byLower.set(name.toLowerCase(), { id: tag._id.toHexString(), name });
  }
  return [...byLower.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Finds or creates each tag. Legacy tags (personal workspaces) match on
// `{sub, tagName}` like legacy does, so no duplicate appears before M5 runs.
export async function ensureTags(
  ctx: ServiceContext,
  names: string[],
  session?: ClientSession,
): Promise<TagRef[]> {
  const wanted = new Map<string, string>();
  for (const raw of names) {
    const name = normalizeTagName(raw);
    if (name && !wanted.has(name.toLowerCase()))
      wanted.set(name.toLowerCase(), name);
  }
  if (!wanted.size) return [];
  const tags = collection(ctx.db, "tags");
  const sub = legacySubOf(ctx);
  const existing = await tags
    .find(
      {
        $and: [
          ownedBy<Tag>(ctx.workspace),
          {
            $or: [
              { nameLower: { $in: [...wanted.keys()] } },
              { tagName: { $in: [...wanted.values()] } },
            ],
          },
        ],
      },
      session ? { session } : {},
    )
    .toArray();
  const refs: TagRef[] = [];
  for (const [lower, name] of wanted) {
    const found = existing.find(
      (tag) => !tag.mergedInto && tagName(tag).toLowerCase() === lower,
    );
    if (found) {
      refs.push({
        _id: found._id,
        id: found.id ?? found._id.toHexString(),
        name: tagName(found),
      });
      continue;
    }
    const now = nowOf(ctx);
    const created = await tags.findOneAndUpdate(
      { workspaceId: ctx.workspace._id, nameLower: lower },
      {
        $setOnInsert: {
          workspaceId: ctx.workspace._id,
          name,
          tagName: name,
          nameLower: lower,
          id: nanoid(6),
          ...(sub ? { sub } : {}),
          createdAt: now,
          updatedAt: now,
          createdBy: ctx.actor.userId,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        ...(session ? { session } : {}),
      },
    );
    if (!created) throw new Error("Tag upsert returned nothing");
    refs.push({
      _id: created._id,
      id: created.id ?? created._id.toHexString(),
      name: tagName(created),
    });
  }
  return refs;
}

// The embedded copy legacy keeps on links and QR codes.
export const embeddedTags = (refs: TagRef[], sub: string | undefined) =>
  refs.map((ref) => ({
    _id: ref._id,
    id: ref.id,
    tagName: ref.name,
    ...(sub ? { sub } : {}),
  }));

export interface TagView {
  id: string;
  legacyId: string | null;
  name: string;
  createdAt: string;
  createdBy: string | null;
}

type TagError = "forbidden" | "not_found" | "invalid_input" | "name_taken";
export const tagView = (tag: Tag): TagView => ({
  id: tag._id.toHexString(),
  legacyId: tag.id ?? null,
  name: tagName(tag),
  createdAt: (tag.createdAt ?? tag._id.getTimestamp()).toISOString(),
  createdBy: typeof tag.createdBy === "string" ? tag.createdBy : null,
});
const literalPattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function ownedTag(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
  session?: ClientSession,
) {
  const objectId = parseObjectId(id);
  return collection(ctx.db, "tags").findOne(
    {
      $and: [
        ownedBy<Tag>(ctx.workspace),
        { mergedInto: { $exists: false } },
        {
          $or: [
            ...(objectId ? [{ _id: objectId }] : []),
            { id },
            { legacyIds: id },
          ],
        },
      ],
    },
    session ? { session } : {},
  );
}
export async function getTag(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
) {
  const tag = await ownedTag(ctx, id);
  return tag ? tagView(tag) : null;
}
export async function cursorTags(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  input: {
    cursor?: string | undefined;
    search?: string | undefined;
    limit?: number | undefined;
  } = {},
) {
  const filter: Filter<Tag> = {
    $and: [
      ownedBy<Tag>(ctx.workspace),
      { mergedInto: { $exists: false } },
      ...(input.search?.trim()
        ? [
            {
              $or: [
                {
                  name: new RegExp(
                    literalPattern(input.search.trim().slice(0, 200)),
                    "i",
                  ),
                },
                {
                  tagName: new RegExp(
                    literalPattern(input.search.trim().slice(0, 200)),
                    "i",
                  ),
                },
              ],
            },
          ]
        : []),
    ],
  };
  const total = input.cursor
    ? null
    : await collection(ctx.db, "tags").countDocuments(filter);
  const cursor = input.cursor ? parseObjectId(input.cursor) : null;
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const docs = await collection(ctx.db, "tags")
    .find(cursor ? { $and: [filter, { _id: { $lt: cursor } }] } : filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();
  const page = docs.slice(0, limit);
  return {
    items: page.map(tagView),
    total,
    nextCursor: docs.length > limit ? page.at(-1)!._id.toHexString() : null,
  };
}
async function duplicateTag(
  ctx: ServiceContext,
  name: string,
  except?: ObjectId,
  session?: ClientSession,
) {
  const exact = new RegExp(`^${literalPattern(name)}$`, "i");
  return collection(ctx.db, "tags").findOne(
    {
      $and: [
        ownedBy<Tag>(ctx.workspace),
        { mergedInto: { $exists: false } },
        ...(except ? [{ _id: { $ne: except } }] : []),
        {
          $or: [
            { nameLower: name.toLowerCase() },
            { name: exact },
            { tagName: exact },
          ],
        },
      ],
    },
    session ? { session } : {},
  );
}
function validName(input: string) {
  const name = normalizeTagName(input);
  return input.length <= 48 && name ? name : null;
}
export async function createTag(
  ctx: ServiceContext,
  input: string,
): Promise<Result<TagView, TagError>> {
  if (!can(ctx.actor, "resource.create")) return fail("forbidden");
  const name = validName(input);
  if (!name) return fail("invalid_input");
  if (await duplicateTag(ctx, name)) return fail("name_taken");
  const now = nowOf(ctx),
    sub = legacySubOf(ctx);
  const tag: Tag = {
    _id: new ObjectId(),
    id: nanoid(6),
    workspaceId: ctx.workspace._id,
    ...(sub ? { sub } : {}),
    name,
    tagName: name,
    nameLower: name.toLowerCase(),
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.actor.userId,
  };
  try {
    await collection(ctx.db, "tags").insertOne(tag);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("name_taken");
    throw error;
  }
  return ok(tagView(tag));
}
interface TagElement {
  _id?: ObjectId;
  id?: string;
  name?: string;
  tagName?: string;
}
interface TaggedDocument {
  workspaceId?: ObjectId;
  sub?: string;
  tags: TagElement[];
  tagIds?: ObjectId[];
  updatedAt?: Date;
}
function tagReference(tag: Tag) {
  const legacy = [
    ...new Set(
      [tag.id, ...(tag.legacyIds ?? [])].filter((id): id is string =>
        Boolean(id),
      ),
    ),
  ];
  return {
    $or: [
      { _id: tag._id },
      ...(legacy.length ? [{ id: { $in: legacy } }] : []),
      {
        $and: [
          { _id: { $exists: false } },
          { id: { $exists: false } },
          { $or: [{ tagName: tagName(tag) }, { name: tagName(tag) }] },
        ],
      },
    ],
  };
}
async function editTagReferences(
  ctx: ServiceContext,
  tag: Tag,
  session: ClientSession,
  name?: string,
) {
  const reference = tagReference(tag);
  const subscribed = await endpoints(ctx.db).findOne(
    { workspaceId: ctx.workspace._id, enabled: true, events: "link.updated" },
    { session, projection: { _id: 1 } },
  );
  if (subscribed)
    for await (const link of collection(ctx.db, "links")
      .find(
        {
          $and: [
            ownedBy<Documents["links"]>(ctx.workspace),
            { $or: [{ tags: { $elemMatch: reference } }, { tagIds: tag._id }] },
          ],
        },
        { session },
      )
      .batchSize(100)) {
      await recordWebhookEvent(
        ctx.db,
        ctx.workspace._id,
        "link.updated",
        linkEventData(link, ctx.linkDomain),
        session,
        nowOf(ctx),
      );
    }
  // Both live and trashed links participate: a workspace-wide tag edit remains
  // consistent when a deleted link is later restored.
  for (const physical of [physicalNames.links, physicalNames.qr_codes]) {
    const resources = ctx.db.collection<TaggedDocument>(physical);
    const owned = ownedBy<TaggedDocument>(ctx.workspace);
    if (name !== undefined) {
      const arrayFilter = {
        $or: [
          { "tag._id": tag._id },
          ...[tag.id, ...(tag.legacyIds ?? [])]
            .filter((id): id is string => Boolean(id))
            .map((id) => ({ "tag.id": id })),
          {
            $and: [
              { "tag._id": { $exists: false } },
              { "tag.id": { $exists: false } },
              {
                $or: [
                  { "tag.tagName": tagName(tag) },
                  { "tag.name": tagName(tag) },
                ],
              },
            ],
          },
        ],
      };
      await resources.updateMany(
        { $and: [owned, { tags: { $elemMatch: reference } }] },
        {
          $set: {
            "tags.$[tag].tagName": name,
            "tags.$[tag].name": name,
            updatedAt: nowOf(ctx),
          },
        },
        { session, arrayFilters: [arrayFilter] },
      );
    } else {
      await resources.updateMany(
        {
          $and: [
            owned,
            { $or: [{ tags: { $elemMatch: reference } }, { tagIds: tag._id }] },
          ],
        },
        [
          {
            $set: {
              tags: {
                $filter: {
                  input: { $ifNull: ["$tags", []] },
                  as: "tag",
                  cond: {
                    $not: [
                      {
                        $or: [
                          { $eq: ["$$tag._id", tag._id] },
                          {
                            $in: [
                              "$$tag.id",
                              [tag.id, ...(tag.legacyIds ?? [])].filter(
                                (id): id is string => Boolean(id),
                              ),
                            ],
                          },
                          {
                            $and: [
                              { $eq: [{ $type: "$$tag._id" }, "missing"] },
                              { $eq: [{ $type: "$$tag.id" }, "missing"] },
                              {
                                $or: [
                                  {
                                    $eq: [
                                      "$$tag.tagName",
                                      { $literal: tagName(tag) },
                                    ],
                                  },
                                  {
                                    $eq: [
                                      "$$tag.name",
                                      { $literal: tagName(tag) },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              },
              tagIds: {
                $filter: {
                  input: { $ifNull: ["$tagIds", []] },
                  as: "tagId",
                  cond: { $ne: ["$$tagId", tag._id] },
                },
              },
              updatedAt: nowOf(ctx),
            },
          },
        ],
        { session },
      );
    }
  }
}
export async function updateTag(
  ctx: ServiceContext,
  id: string,
  input: string,
): Promise<Result<TagView, TagError>> {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden");
  const name = validName(input);
  if (!name) return fail("invalid_input");
  const session = ctx.db.client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        const tag = await ownedTag(ctx, id, session);
        if (!tag) return fail("not_found");
        if (tagName(tag) === name) return ok(tagView(tag));
        if (await duplicateTag(ctx, name, tag._id, session))
          return fail("name_taken");
        await editTagReferences(ctx, tag, session, name);
        const updated = await collection(ctx.db, "tags").findOneAndUpdate(
          { _id: tag._id },
          {
            $set: {
              name,
              tagName: name,
              nameLower: name.toLowerCase(),
              updatedAt: nowOf(ctx),
            },
          },
          { session, returnDocument: "after" },
        );
        return updated ? ok(tagView(updated)) : fail("not_found");
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("name_taken");
    throw error;
  } finally {
    await session.endSession();
  }
}
export async function deleteTag(
  ctx: ServiceContext,
  id: string,
): Promise<Result<null, TagError>> {
  if (!can(ctx.actor, "resource.update")) return fail("forbidden");
  const session = ctx.db.client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        const tag = await ownedTag(ctx, id, session);
        if (!tag) return ok(null);
        if (
          !can(ctx.actor, "resource.delete", {
            createdBy:
              typeof tag.createdBy === "string" ? tag.createdBy : undefined,
          })
        )
          return fail("forbidden");
        await editTagReferences(ctx, tag, session);
        await collection(ctx.db, "tags").deleteOne(
          { _id: tag._id },
          { session },
        );
        return ok(null);
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    await session.endSession();
  }
}
