# packages/redis/index.ts

- RedisUrls · interface · L2-L6 — interface RedisUrls
- assertDurableRedis · function · L7-L16 — async function assertDurableRedis( client: Pick<Redis, "config" | "info">, )
- createRedisClients · function · L18-L47 — async function createRedisClients(urls: RedisUrls)
- part · function · L48-L48 — part = (input: string)
- normalizeDomain · function · L49-L51 — function normalizeDomain(input: string): string
- UsageMetric · type · L52-L52 — type UsageMetric = "links" | "qr_codes" | "bio_pages";
- LinkInvalidation · interface · L62-L65 — interface LinkInvalidation
- InvalidationStore · interface · L66-L68 — interface InvalidationStore extends CacheStore
- invalidateLinks · function · L72-L88 — async function invalidateLinks( store: InvalidationStore, domain: string, linkKeys: Iterable<string>, )
- CacheStore · interface · L89-L96 — interface CacheStore
- generationKey · function · L107-L107 — generationKey = (key: string)
- assertTtl · function · L108-L111 — function assertTtl(ttlSeconds: number)
- createCache · function · L112-L188 — function createCache<T>( store: CacheStore, decode: (encoded: string) => T, encode: (value: T) => string = JSON.stringify, )
- get · method · L119-L175 — async get( key: string, ttl: number | ((value: T) => number), load: () => Promise<T>, ): Promise<T>
- invalidate · method · L176-L186 — async invalidate(key: string)
