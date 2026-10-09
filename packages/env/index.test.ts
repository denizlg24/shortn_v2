import { expect, test } from "bun:test";
import { z } from "zod";
import {
  apiEnv,
  envExample,
  legacyInfraEnv,
  parseEnv,
  redirectEnv,
  webEnv,
  workerEnv,
} from "./index";
test("errors name missing fields without leaking values", () => {
  expect(() =>
    parseEnv(z.object({ TOKEN: z.string().min(32) }), { TOKEN: "private" }),
  ).toThrow("TOKEN:");
  expect(() => parseEnv(webEnv, {})).toThrow("Invalid environment");
});
test("coercion and defaults", () => {
  expect(
    parseEnv(z.object({ PORT: z.coerce.number().default(3000) }), {}),
  ).toEqual({ PORT: 3000 });
});
test("every schema field is represented in the generated example", () => {
  for (const schema of [webEnv, redirectEnv, apiEnv, workerEnv, legacyInfraEnv])
    for (const key of Object.keys(schema.shape))
      expect(envExample()).toContain(`${key}=`);
  expect(envExample()).not.toContain("STRIPE_");
});

function redirectFixture() {
  return {
    MONGODB_URL: "mongodb://127.0.0.1:27017",
    MONGODB_DB: "fixture",
    REDIS_CACHE_URL: "redis://127.0.0.1:6380",
    REDIS_DURABLE_URL: "redis://127.0.0.1:6379",
    LINK_ACCESS_SECRET: "link-access-7c8dd46cd294442db3163258",
    AUTH_SECRET: "legacy-auth-94f9c23ee8624b2cb0b7237e",
    IP_HASH_SECRET: "ip-hash-61bde786a1924b208820e7367821",
    PUBLIC_ORIGIN: "https://shortn.at",
  };
}
test("placeholder secrets are rejected in every app schema", () => {
  for (const schema of [webEnv, redirectEnv, apiEnv, workerEnv]) {
    for (const [key, field] of Object.entries(schema.shape)) {
      if (
        field.meta()?.example !==
        "replace-with-a-distinct-secret-at-least-32-characters"
      )
        continue;
      for (const value of [
        "replace-with-a-distinct-secret-at-least-32-characters",
        "a".repeat(64),
        "your-secret-which-is-over-32-characters",
      ])
        expect(field.safeParse(value).success).toBe(false);
      expect(
        field.safeParse(`${key}-94f9c23ee8624b2cb0b7237eaa720d98`).success,
      ).toBe(true);
    }
  }
});
test("production requires distinct secrets and separate Redis URLs", () => {
  const fixture = { ...redirectFixture(), NODE_ENV: "production" };
  expect(redirectEnv.safeParse(fixture).success).toBe(true);
  expect(
    redirectEnv.safeParse({
      ...fixture,
      AUTH_SECRET: fixture.LINK_ACCESS_SECRET,
    }).success,
  ).toBe(false);
  expect(
    redirectEnv.safeParse({
      ...fixture,
      REDIS_DURABLE_URL: fixture.REDIS_CACHE_URL,
    }).success,
  ).toBe(false);
  expect(
    redirectEnv.safeParse({
      ...redirectFixture(),
      REDIS_DURABLE_URL: fixture.REDIS_CACHE_URL,
    }).success,
  ).toBe(true);
});
test("href environment URLs require http(s)", () => {
  expect(
    webEnv.shape.BETTER_AUTH_URL.safeParse("javascript:alert(1)").success,
  ).toBe(false);
  expect(
    redirectEnv.shape.PUBLIC_ORIGIN.safeParse("data:text/plain,foo").success,
  ).toBe(false);
  expect(
    apiEnv.shape.R2_ENDPOINT.safeParse("https://example.com").success,
  ).toBe(true);
});
