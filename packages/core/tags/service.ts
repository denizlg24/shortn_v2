import { collection, type Documents } from "@shortn/db";
import { nanoid } from "nanoid";
import type { ObjectId } from "mongodb";
import { legacySubOf, nowOf, type ServiceContext } from "../workspaces/context";
import { ownedBy } from "../workspaces/service";

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
    .find({
      $or: [
        {
          workspaceId: ctx.workspace._id,
          nameLower: { $in: [...wanted.keys()] },
        },
        ...(sub ? [{ sub, tagName: { $in: [...wanted.values()] } }] : []),
      ],
    })
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
        },
      },
      { upsert: true, returnDocument: "after" },
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
