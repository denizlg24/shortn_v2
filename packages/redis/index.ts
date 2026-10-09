import { Redis } from "ioredis";
export interface RedisUrls {
  REDIS_CACHE_URL: string;
  REDIS_DURABLE_URL: string;
  NODE_ENV?: string;
}
export async function assertDurableRedis(
  client: Pick<Redis, "config" | "info">,
) {
  const policy = await client.config("GET", "maxmemory-policy");
  const persistence = await client.info("persistence");
  if (!Array.isArray(policy) || policy[1] !== "noeviction")
    throw new Error("Durable Redis requires maxmemory-policy noeviction");
  if (!/^aof_enabled:1\r?$/m.test(persistence))
    throw new Error("Durable Redis requires AOF enabled");
}
// Startup completes only after the durable instance passes its persistence checks.
export async function createRedisClients(urls: RedisUrls) {
  if (
    (urls.NODE_ENV ?? process.env.NODE_ENV) === "production" &&
    urls.REDIS_CACHE_URL === urls.REDIS_DURABLE_URL
  )
    throw new Error("Production Redis URLs must differ");
  const cache = new Redis(urls.REDIS_CACHE_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 1000,
    connectTimeout: 1000,
  });
  const durable = new Redis(urls.REDIS_DURABLE_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    commandTimeout: 5000,
    connectTimeout: 1000,
  });
  try {
    await Promise.all([cache.connect(), durable.connect()]);
    await assertDurableRedis(durable);
    return { cache, durable };
  } catch (error) {
    cache.disconnect();
    durable.disconnect();
    throw error;
  }
}
const part = (input: string) => encodeURIComponent(input);
export function normalizeDomain(input: string): string {
  return new URL(`http://${input}`).hostname.toLowerCase().replace(/\.$/, "");
}
export type UsageMetric = "links" | "qr_codes" | "bio_pages";
export const keys = {
  link: (domain: string, key: string) =>
    `link:${part(normalizeDomain(domain))}:${part(key)}`,
  usage: (workspace: string, period: string, metric: UsageMetric) =>
    `usage:${part(workspace)}:${part(period)}:${metric}`,
  entitlements: (workspace: string) => `ent:${part(workspace)}`,
  clicksStream: "clicks:stream",
};
export const linkInvalidateChannel = "link-invalidate";
export interface LinkInvalidation {
  domain: string;
  keys: string[];
}
export interface InvalidationStore extends CacheStore {
  publish(channel: string, message: string): Promise<number>;
}
// Every writer of link data calls this after a successful write, so cached
// positive and negative entries disappear from Redis and from each redirect
// process's in-memory layer.
export async function invalidateLinks(
  store: InvalidationStore,
  domain: string,
  linkKeys: Iterable<string>,
) {
  const unique = [...new Set(linkKeys)].filter(Boolean);
  if (!unique.length) return;
  const cache = createCache(store, String);
  await Promise.all(
    unique.map((key) => cache.invalidate(keys.link(domain, key))),
  );
  const message: LinkInvalidation = {
    domain: normalizeDomain(domain),
    keys: unique,
  };
  await store.publish(linkInvalidateChannel, JSON.stringify(message));
}
export interface CacheStore {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
  del(key: string): Promise<number>;
}
// A random generation, rather than zero, remains safe if the cache evicts the fence.
export const cacheScripts = {
  read: `local token = redis.call('GET', KEYS[2])
if not token then token = ARGV[1]; redis.call('SET', KEYS[2], token) end
return {token, redis.call('GET', KEYS[1]) or false}`,
  write: `if redis.call('GET', KEYS[2]) == ARGV[1] then
return redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) end
return false`,
  invalidate: `redis.call('SET', KEYS[2], ARGV[1]); return redis.call('DEL', KEYS[1])`,
};
export const generationKey = (key: string) => `cache-generation:${key}`;
function assertTtl(ttlSeconds: number) {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0)
    throw new Error("Cache TTL must be a positive integer");
}
export function createCache<T>(
  store: CacheStore,
  decode: (encoded: string) => T,
  encode: (value: T) => string = JSON.stringify,
) {
  const pending = new Map<string, Promise<T>>();
  return {
    async get(
      key: string,
      ttl: number | ((value: T) => number),
      load: () => Promise<T>,
    ): Promise<T> {
      const ttlFor = typeof ttl === "number" ? () => ttl : ttl;
      if (typeof ttl === "number") assertTtl(ttl);
      const existing = pending.get(key);
      if (existing) return existing;
      const request = (async () => {
        let token: string;
        try {
          const result = await store.eval(
            cacheScripts.read,
            2,
            key,
            generationKey(key),
            crypto.randomUUID(),
          );
          if (!Array.isArray(result) || typeof result[0] !== "string")
            throw new Error("Invalid cache reply");
          token = result[0];
          if (typeof result[1] === "string") {
            try {
              return decode(result[1]);
            } catch {
              await store.del(key);
            }
          }
        } catch {
          return load();
        }
        const loaded = await load();
        const ttlSeconds = ttlFor(loaded);
        assertTtl(ttlSeconds);
        try {
          await store.eval(
            cacheScripts.write,
            2,
            key,
            generationKey(key),
            token,
            encode(loaded),
            ttlSeconds,
          );
        } catch {
          /* The database value is available even during a cache outage. */
        }
        return loaded;
      })();
      pending.set(key, request);
      try {
        return await request;
      } finally {
        if (pending.get(key) === request) pending.delete(key);
      }
    },
    async invalidate(key: string) {
      pending.delete(key);
      // Propagate invalidation failure so mutation callers can retry it.
      await store.eval(
        cacheScripts.invalidate,
        2,
        key,
        generationKey(key),
        crypto.randomUUID(),
      );
    },
  };
}
