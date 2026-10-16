import "server-only";
import { bulkLinkTagsSchema, can, type ServiceContext } from "@shortn/core";
import { redis } from "./redis";
const selectionKey = (ctx: ServiceContext, ref: string) =>
  `links:tag-selection:${ctx.workspace._id}:${ctx.actor.userId}:${ref}`;
export async function saveBulkTagSelection(ctx: ServiceContext, ids: string[]) {
  if (
    !can(ctx.actor, "resource.update") ||
    !bulkLinkTagsSchema.shape.ids.safeParse(ids).success
  )
    return null;
  const ref = crypto.randomUUID();
  await (
    await redis()
  ).durable.set(
    selectionKey(ctx, ref),
    JSON.stringify([...new Set(ids)]),
    "EX",
    86400,
    "NX",
  );
  return ref;
}
export async function readBulkTagSelection(ctx: ServiceContext, ref: unknown) {
  if (
    !can(ctx.actor, "resource.update") ||
    typeof ref !== "string" ||
    !/^[a-f\d-]{36}$/.test(ref)
  )
    return [];
  const value = await (await redis()).durable.get(selectionKey(ctx, ref));
  if (!value) return [];
  try {
    const parsed = bulkLinkTagsSchema.shape.ids.safeParse(JSON.parse(value));
    return parsed.success ? [...new Set(parsed.data)] : [];
  } catch {
    return [];
  }
}
