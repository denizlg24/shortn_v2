import { createHash } from "node:crypto";
import type { CacheStore } from "@shortn/redis";
import { z } from "zod";

export type SafetyCache = Pick<CacheStore, "eval">;
export const safetyCacheScripts = {
  read: "return redis.call('GET', KEYS[1])",
  write: "return redis.call('SET', KEYS[1], ARGV[1], 'PXAT', ARGV[2])",
};
export const safetyDigest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const pending = new WeakMap<SafetyCache, Map<string, Promise<unknown>>>();

/** Shared provider data only; cache failures must never become safe verdicts. */
export async function cachedSafetyLookup<T>(
  cache: SafetyCache | undefined,
  key: string,
  schema: z.ZodType<T>,
  load: () => Promise<{ value: T; expiresAt?: number }>,
): Promise<T> {
  if (!cache) return (await load()).value;
  let requests = pending.get(cache);
  if (!requests) {
    requests = new Map();
    pending.set(cache, requests);
  }
  const existing = requests.get(key);
  if (existing) return existing as Promise<T>;
  const request = (async () => {
    try {
      const raw = await cache.eval(safetyCacheScripts.read, 1, key);
      if (typeof raw === "string") {
        const entry = z
          .object({
            expiresAt: z.number().finite(),
            value: schema,
          })
          .safeParse(JSON.parse(raw));
        if (entry.success && entry.data.expiresAt > Date.now())
          return entry.data.value;
      }
    } catch {
      // Missing, malformed and unavailable cache entries all use the provider.
    }
    const entry = await load();
    if (entry.expiresAt && entry.expiresAt > Date.now()) {
      try {
        // Absolute expiry prevents a slow write from extending a provider match.
        await cache.eval(
          safetyCacheScripts.write,
          1,
          key,
          JSON.stringify(entry),
          entry.expiresAt,
        );
      } catch {
        // Persistence is optional; the provider result remains authoritative.
      }
    }
    return entry.value;
  })();
  requests.set(key, request);
  try {
    return await request;
  } finally {
    requests.delete(key);
  }
}
