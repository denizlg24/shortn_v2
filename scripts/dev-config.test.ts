import { expect, test } from "bun:test";
import { parseEnv } from "node:util";
import { devConfig } from "./dev-config";
import { envExample } from "../packages/env/index";

function fixture() {
  const source = parseEnv(envExample());
  for (const key of Object.keys(source)) {
    if (source[key]!.includes("replace"))
      source[key] = `${key}-94f9c23ee8624b2cb0b7237eaa720d98`;
  }
  source.S3_ENDPOINT = "https://storage.example.org";
  source.S3_REGION = "us-east-1";
  source.S3_BUCKET = "staging-test";
  source.S3_ACCESS_KEY_ID = "dev-key";
  source.S3_SECRET_ACCESS_KEY = "dev-secret";
  delete source.MONGODB_URL;
  delete source.MONGODB_DB;
  source.MONGODB_KEY = "mongodb://staging.example:27017/staging_db";
  return source;
}
test("maps legacy staging configuration and isolates local app origins", () => {
  const config = devConfig(fixture(), {
    DEV_WEB_PORT: "3100",
    MONGODB_URL: "mongodb://unwanted.local",
  });
  expect(config.shared.MONGODB_URL).toBe(
    "mongodb://staging.example:27017/staging_db",
  );
  expect(config.shared.MONGODB_DB).toBe("staging_db");
  expect(config.shared.BETTER_AUTH_URL).toBe("http://localhost:3100");
  expect(config.shared.PUBLIC_ORIGIN).toBe("http://localhost:3100");
  expect(config.infrastructure).not.toContain("mongo");
});
test("local database fallback and deterministic distinct signing keys", () => {
  const source = fixture();
  delete source.MONGODB_KEY;
  delete source.LINK_ACCESS_SECRET;
  delete source.CONFIRMATION_TOKEN_SECRET;
  const first = devConfig(source);
  const second = devConfig(source);
  expect(first.infrastructure).toContain("mongo-init");
  expect(first.shared.LINK_ACCESS_SECRET).toBe(
    second.shared.LINK_ACCESS_SECRET,
  );
  expect(first.shared.LINK_ACCESS_SECRET).not.toBe(
    first.shared.CONFIRMATION_TOKEN_SECRET,
  );
});
test("rejects port conflicts and missing required staging credentials", () => {
  expect(() => devConfig(fixture(), { DEV_API_PORT: "3000" })).toThrow(
    "distinct",
  );
  expect(() => devConfig(fixture(), { DEV_API_PORT: "0" })).toThrow(
    "valid port",
  );
  const source = fixture();
  delete source.BETTER_AUTH_SECRET;
  expect(() => devConfig(source)).toThrow("BETTER_AUTH_SECRET");
});

test("starts only dedicated dependencies and preserves explicit connections", () => {
  const source = fixture();
  delete source.REDIS_CACHE_URL;
  delete source.REDIS_DURABLE_URL;
  expect(devConfig(source).infrastructure).toEqual([
    "redis-cache",
    "redis-durable",
  ]);
  source.REDIS_CACHE_URL = "redis://localhost";
  source.REDIS_DURABLE_URL = "redis://remote.example:6379";
  source.MONGODB_KEY = "mongodb://localhost/staging_db";
  expect(devConfig(source).infrastructure).toEqual([]);
});

test("uses local S3 only when staging storage is absent", () => {
  const source = fixture();
  for (const key of Object.keys(source))
    if (key.startsWith("S3_")) delete source[key];
  const config = devConfig(source);
  expect(config.shared.S3_ENDPOINT).toBe("http://127.0.0.1:19000");
  expect(config.infrastructure).toContain("storage-init");
  source.S3_ENDPOINT = "https://storage.example.org";
  expect(() => devConfig(source)).toThrow("Incomplete S3 configuration");
});
