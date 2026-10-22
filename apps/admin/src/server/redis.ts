import "server-only";
import { Redis } from "ioredis";
import { env } from "./env";

let cache: Redis | undefined;
let durable: Redis | null | undefined;

/** The cache instance: rate limits, link invalidation, suspension publish. */
export function cacheRedis() {
  cache ??= new Redis(env().REDIS_CACHE_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 1000,
    connectTimeout: 1000,
  });
  return cache;
}

/** Read-only queue depth; panels degrade when it's not configured. */
export function durableRedis() {
  if (durable === undefined) {
    const url = env().REDIS_DURABLE_URL;
    durable = url
      ? new Redis(url, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          commandTimeout: 2000,
          connectTimeout: 1000,
        })
      : null;
  }
  return durable;
}
