import { afterAll, describe, expect, test } from "bun:test";
import Redis from "ioredis";
import { consumeAuthRateLimit } from "./rate-limit";

const url = process.env.REDIS_TEST_URL;
(url ? describe : describe.skip)("distributed auth rate limits", () => {
  const redis = new Redis(url!, { lazyConnect: true });
  const keys: string[] = [];
  const key = () => {
    const value = crypto.randomUUID();
    keys.push(`auth-rl:v2:${value}`);
    return value;
  };
  afterAll(async () => {
    if (keys.length) await redis.del(...keys);
    redis.disconnect();
  });

  test("concurrent instances share one limit and rejected requests preserve expiry", async () => {
    const id = key();
    const decisions = await Promise.all(
      Array.from({ length: 100 }, () =>
        consumeAuthRateLimit(redis, id, { window: 120, max: 10 }),
      ),
    );
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(10);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(90);
    expect(
      decisions
        .filter((decision) => decision.allowed)
        .every((decision) => decision.retryAfter === null),
    ).toBe(true);
    expect(
      decisions
        .filter((decision) => !decision.allowed)
        .every(
          (decision) => decision.retryAfter! > 0 && decision.retryAfter! <= 120,
        ),
    ).toBe(true);
    const before = await redis.pttl(`auth-rl:v2:${id}`);
    await consumeAuthRateLimit(redis, id, { window: 120, max: 10 });
    expect(await redis.pttl(`auth-rl:v2:${id}`)).toBeLessThanOrEqual(before);
  });

  test("expired windows reset and separate keys remain independent", async () => {
    const id = key(),
      independent = key(),
      rule = { window: 120, max: 1 };
    expect((await consumeAuthRateLimit(redis, id, rule)).allowed).toBe(true);
    expect((await consumeAuthRateLimit(redis, id, rule)).allowed).toBe(false);
    expect((await consumeAuthRateLimit(redis, independent, rule)).allowed).toBe(
      true,
    );
    await redis.hset(`auth-rl:v2:${id}`, "started", Date.now() - 121000);
    expect((await consumeAuthRateLimit(redis, id, rule)).allowed).toBe(true);
    expect(await redis.hget(`auth-rl:v2:${id}`, "count")).toBe("1");
  });
});
