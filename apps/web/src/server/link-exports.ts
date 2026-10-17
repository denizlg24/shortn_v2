import "server-only";
import { z } from "zod";
import { createObjectStore, type ObjectStore } from "@shortn/storage";
import {
  prepareLinkExport,
  linkExportFilterSchema,
  workspaceContext,
  type ServiceContext,
} from "@shortn/core";
import { getSession } from "./auth";
import { db } from "./db";
import { env } from "./env";
import { redis } from "./redis";

let store: ObjectStore | undefined;
export function linkExportStore() {
  const config = env();
  if (
    config.EXPORTS_ENABLED !== "1" ||
    !config.S3_ENDPOINT ||
    !config.S3_REGION ||
    !config.S3_BUCKET ||
    !config.S3_ACCESS_KEY_ID ||
    !config.S3_SECRET_ACCESS_KEY
  )
    return null;
  store ??= createObjectStore({
    S3_ENDPOINT: config.S3_ENDPOINT,
    S3_REGION: config.S3_REGION,
    S3_BUCKET: config.S3_BUCKET,
    S3_ACCESS_KEY_ID: config.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: config.S3_SECRET_ACCESS_KEY,
  });
  return store;
}
export async function linkExportHttpContext(workspace: string) {
  const session = await getSession();
  if (!session) return { error: "unauthorized", status: 401 } as const;
  const database = await db(),
    access = await workspaceContext(database, session.user.id, workspace);
  if (!access) return { error: "not_found", status: 404 } as const;
  const ctx: ServiceContext = {
    db: database,
    workspace: access.workspace,
    actor: access.actor,
    cache: (await redis()).cache,
    linkDomain: env().LINK_DOMAIN,
  };
  return { ctx };
}
const date = z.union([
  z.date(),
  z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
]);
export const linkExportHttpFilter = linkExportFilterSchema.extend({
  createdAfter: date.optional(),
  createdBefore: date.optional(),
});
const requestSchema = z
  .object({
    format: z.enum(["csv", "json"]),
    filter: linkExportHttpFilter.default({}),
    requestId: z.uuid().optional(),
  })
  .strict();
const selectionSchema = z
  .object({
    format: z.enum(["csv", "json"]),
    filter: linkExportHttpFilter,
    selection: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(4999),
    expiresAt: z.iso.datetime(),
  })
  .strict();
const selectionKey = (ctx: ServiceContext, ref: string) =>
  `exports:selection:${ctx.workspace._id}:${ctx.actor.userId}:${ref}`;

export async function requestLinksExport(
  ctx: ServiceContext,
  workspace: string,
  input: unknown,
) {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_export" } as const;
  const prepared = await prepareLinkExport(
    ctx,
    parsed.data.filter,
    parsed.data.format,
    parsed.data.requestId,
  );
  if (!prepared.ok) return prepared;
  const result = prepared.value;
  if (result.mode === "job")
    return {
      ok: true,
      value: {
        mode: "job",
        job: result.job,
        statusUrl: `/api/link-exports/${encodeURIComponent(workspace)}/jobs/${result.job.id}`,
      },
    } as const;
  const ref = crypto.randomUUID(),
    expiresAt = new Date(Date.now() + 900_000).toISOString();
  await (
    await redis()
  ).durable.set(
    selectionKey(ctx, ref),
    JSON.stringify({
      format: result.format,
      filter: result.filter,
      selection: result.selection,
      expiresAt,
    }),
    "EX",
    900,
    "NX",
  );
  return {
    ok: true,
    value: {
      mode: "download",
      format: result.format,
      total: result.total,
      expiresAt,
      downloadUrl: `/api/link-exports/${encodeURIComponent(workspace)}/download/${ref}`,
    },
  } as const;
}
export async function readLinkExportSelection(
  ctx: ServiceContext,
  ref: string,
) {
  if (!z.uuid().safeParse(ref).success) return null;
  const value = await (await redis()).durable.get(selectionKey(ctx, ref));
  if (!value || value.length > 200_000) return null;
  let parsed: ReturnType<typeof selectionSchema.safeParse>;
  try {
    parsed = selectionSchema.safeParse(JSON.parse(value));
  } catch {
    return null;
  }
  if (!parsed.success || Date.parse(parsed.data.expiresAt) <= Date.now())
    return null;
  return parsed.data;
}
