import {
  cacheTtlSeconds,
  decodeCachedLink,
  encodeCachedLink,
  mongoLinkLoader as coreMongoLinkLoader,
} from "@shortn/core";
import type { CachedLink, LinkLoader } from "@shortn/core";
export type { LinkLoader } from "@shortn/core";
import { createCache, keys, normalizeDomain } from "@shortn/redis";
import type { CacheStore, LinkInvalidation } from "@shortn/redis";
import type { Db } from "mongodb";
import { z } from "zod";
import { metrics } from "./metrics";

// Retain the redirect module's public API and its Mongo-load metric.
export function mongoLinkLoader(db: Db, rootDomain = "shortn.at"): LinkLoader {
  return coreMongoLinkLoader(db, rootDomain, () =>
    metrics.inc("resolve_mongo_total"),
  );
}

interface Entry {
  value: CachedLink;
  expires: number;
}

export class MemoryLayer {
  private readonly entries = new Map<string, Entry>();
  constructor(
    private readonly maxEntries = 10_000,
    private readonly ttlMs = 10_000,
  ) {}
  get(cacheKey: string): CachedLink | undefined {
    const entry = this.entries.get(cacheKey);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.entries.delete(cacheKey);
      return undefined;
    }
    return entry.value;
  }
  set(cacheKey: string, value: CachedLink) {
    this.entries.delete(cacheKey);
    this.entries.set(cacheKey, { value, expires: Date.now() + this.ttlMs });
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
  }
  delete(cacheKey: string) {
    this.entries.delete(cacheKey);
  }
  clear() {
    this.entries.clear();
  }
  get size() {
    return this.entries.size;
  }
}

export function createResolver(
  store: CacheStore,
  load: LinkLoader,
  memory = new MemoryLayer(),
) {
  const redis = createCache<CachedLink>(
    store,
    decodeCachedLink,
    encodeCachedLink,
  );
  return {
    memory,
    async resolve(domain: string, key: string): Promise<CachedLink> {
      const cacheKey = keys.link(domain, key);
      const hit = memory.get(cacheKey);
      if (hit) {
        metrics.inc("resolve_l1_hit_total");
        return hit;
      }
      const value = await redis.get(cacheKey, cacheTtlSeconds, () =>
        load(
          new URL(`http://${domain}`).port
            ? `${normalizeDomain(domain)}:${new URL(`http://${domain}`).port}`
            : normalizeDomain(domain),
          key,
        ),
      );
      memory.set(cacheKey, value);
      return value;
    },
    evict(message: LinkInvalidation) {
      for (const key of message.keys)
        memory.delete(keys.link(message.domain, key));
    },
  };
}
export type Resolver = ReturnType<typeof createResolver>;

const invalidationSchema = z.object({
  domain: z.string(),
  keys: z.array(z.string()),
});

export function parseInvalidation(
  payload: string,
): LinkInvalidation | undefined {
  try {
    const parsed = invalidationSchema.safeParse(JSON.parse(payload));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
