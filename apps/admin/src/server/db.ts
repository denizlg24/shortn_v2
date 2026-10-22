import "server-only";
import { getDb } from "@shortn/db";
import { env } from "./env";

export const db = () => {
  const e = env();
  return getDb({
    url: e.MONGODB_URL,
    database: e.MONGODB_DB,
    maxPoolSize: e.MONGODB_POOL_SIZE,
  });
};
