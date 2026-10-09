import { Redis } from "ioredis";
export interface RedisUrls {
  REDIS_CACHE_URL: string;
  REDIS_DURABLE_URL: string;
}
export function createRedisClients(urls: RedisUrls) {
  return {
    cache: new Redis(urls.REDIS_CACHE_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    }),
    durable: new Redis(urls.REDIS_DURABLE_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    }),
  };
}
const part = (input: string) => encodeURIComponent(input);
export type UsageMetric = "links" | "qr_codes" | "bio_pages";
export const keys = {
  link: (domain: string, key: string) => `link:${part(domain)}:${part(key)}`,
  usage: (workspace: string, period: string, metric: UsageMetric) =>
    `usage:${part(workspace)}:${part(period)}:${metric}`,
  entitlements: (workspace: string) => `ent:${part(workspace)}`,
  clicksStream: "clicks:stream",
};
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: "EX",
    seconds: number,
  ): Promise<string | null>;
  del(key: string): Promise<number>;
}
export function createCache<T>(
  store: CacheStore,
  decode: (encoded: string) => T,
  encode: (value: T) => string = JSON.stringify,
) {
  const pending = new Map<
    string,
    { promise: Promise<T>; validity: { valid: boolean } }
  >();
  return {
    async get(
      key: string,
      ttlSeconds: number,
      load: () => Promise<T>,
    ): Promise<T> {
      if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0)
        throw new Error("Cache TTL must be a positive integer");
      const existing = pending.get(key);
      if (existing) return existing.promise;
      const validity = { valid: true };
      const request = (async () => {
        const cached = await store.get(key);
        if (cached !== null) return decode(cached);
        const loaded = await load();
        if (validity.valid)
          await store.set(key, encode(loaded), "EX", ttlSeconds);
        return loaded;
      })();
      const slot = { promise: request, validity };
      pending.set(key, slot);
      try {
        return await request;
      } finally {
        if (pending.get(key) === slot) pending.delete(key);
      }
    },
    async invalidate(key: string) {
      const slot = pending.get(key);
      if (slot) slot.validity.valid = false;
      pending.delete(key);
      await store.del(key);
    },
  };
}
