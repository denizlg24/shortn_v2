import "server-only";
import { getDb } from "@shortn/db";
import { env } from "./env";

export function mongoConfig() {
  const e = env();
  return {
    url: e.MONGODB_URL,
    database: e.MONGODB_DB,
    maxPoolSize: e.MONGODB_POOL_SIZE,
  };
}

export const db = () => getDb(mongoConfig());
