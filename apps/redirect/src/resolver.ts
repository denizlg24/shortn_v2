import {
  cacheTtlSeconds,
  decodeCachedLink,
  encodeCachedLink,
  isLegacyQrBacked,
  linkProjection,
  toCachedLink,
} from "@shortn/core";
import type {
  CachedLink,
  LegacyLinkFields,
  LegacyQrFields,
} from "@shortn/core";
import { physicalNames } from "@shortn/db";
import { createCache, keys, normalizeDomain } from "@shortn/redis";
import type { CacheStore, LinkInvalidation } from "@shortn/redis";
import type { Db } from "mongodb";
import { z } from "zod";
import { metrics } from "./metrics";

export type LinkLoader = (domain: string, key: string) => Promise<CachedLink>;

// Legacy fields are authoritative during coexistence: urlCode first (legacy's
// own lookup), then the derived {domain,key}, then renamed-key aliases.
export function mongoLinkLoader(db: Db): LinkLoader {
  const links = db.collection<LegacyLinkFields>(physicalNames.links);
  const qrCodes = db.collection<LegacyQrFields>(physicalNames.qr_codes);
  return async (domain, key) => {
    metrics.inc("resolve_mongo_total");
    const link =
      (await links.findOne({ urlCode: key }, { projection: linkProjection })) ??
      (await links.findOne({ domain, key }, { projection: linkProjection }));
    if (link) {
      const qr = isLegacyQrBacked(link)
        ? await qrCodes.findOne(
            { urlId: link.urlCode ?? key },
            { projection: { _id: 1, qrCodeId: 1 } },
          )
        : null;
      return toCachedLink(link, key, qr);
    }
    const alias = await links.findOne(
      { domain, previousKeys: key },
      { projection: { _id: 1, urlCode: 1, key: 1 } },
    );
    const canonical = alias?.urlCode ?? alias?.key;
    if (alias && canonical)
      return { kind: "alias", id: alias._id.toHexString(), key: canonical };
    return { kind: "missing" };
  };
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
        load(normalizeDomain(domain), key),
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
