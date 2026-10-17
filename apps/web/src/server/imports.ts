import "server-only";
import { createObjectStore, type ObjectStore } from "@shortn/storage";
import { env } from "./env";

let store: ObjectStore | undefined;
export function importStore() {
  const config = env();
  if (
    config.IMPORTS_ENABLED !== "1" ||
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
