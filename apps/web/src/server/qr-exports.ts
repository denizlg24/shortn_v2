import "server-only";
import { createObjectStore, type ObjectStore } from "@shortn/storage";
import { env } from "./env";
import { redis } from "./redis";
import type { ServiceContext } from "@shortn/core";
import { normalizeSelection } from "@/lib/bulk-selection";

let store: ObjectStore | undefined;
export function qrExportStore() {
  const config = env();
  if (
    config.QR_EXPORTS_ENABLED !== "1" ||
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

export async function saveQrSelection(ctx: ServiceContext, ids: string[]) {
  const ref = crypto.randomUUID();
  await (
    await redis()
  ).durable.set(
    `qr:selection:${ctx.workspace._id}:${ctx.actor.userId}:${ref}`,
    JSON.stringify(ids),
    "EX",
    86400,
    "NX",
  );
  return ref;
}
export async function readQrSelection(ctx: ServiceContext, ref: unknown) {
  if (typeof ref !== "string" || !/^[a-f0-9-]{36}$/i.test(ref)) return [];
  const value = await (
    await redis()
  ).durable.get(`qr:selection:${ctx.workspace._id}:${ctx.actor.userId}:${ref}`);
  if (!value) return [];
  try {
    return normalizeSelection(JSON.parse(value));
  } catch {
    return [];
  }
}
