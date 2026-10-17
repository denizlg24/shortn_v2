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
test("CSV import worker defaults off and requires complete secure private storage", () => {
  const base = {
    ...redirectFixture(),
    LINK_DOMAIN: "shortn.at",
    POLAR_ENVIRONMENT: "sandbox",
  };
  expect(parseEnv(workerEnv, base).IMPORTS_ENABLED).toBe("0");
  expect(() => parseEnv(workerEnv, { ...base, IMPORTS_ENABLED: "1" })).toThrow(
    "S3_ENDPOINT",
  );
  const enabled = {
    ...base,
    IMPORTS_ENABLED: "1",
    S3_ENDPOINT: "https://storage.example",
    S3_REGION: "local",
    S3_BUCKET: "synthetic",
    S3_ACCESS_KEY_ID: "synthetic",
    S3_SECRET_ACCESS_KEY: "synthetic",
  };
  expect(parseEnv(workerEnv, enabled).IMPORTS_ENABLED).toBe("1");
  for (const key of [
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ])
    expect(() => parseEnv(workerEnv, { ...enabled, [key]: undefined })).toThrow(
      key,
    );
  expect(() =>
    parseEnv(workerEnv, {
      ...enabled,
      NODE_ENV: "production",
      S3_ENDPOINT: "http://storage.example",
    }),
  ).toThrow("S3_ENDPOINT");
});
test("private data exports default off independently and require secure storage in web, API and worker", () => {
  const base = {
    ...redirectFixture(),
    LINK_DOMAIN: "shortn.at",
    POLAR_ENVIRONMENT: "sandbox",
    BETTER_AUTH_SECRET: "synthetic-auth-7c8dd46cd294442db3163258",
    BETTER_AUTH_URL: "https://app.shortn.at",
    POLAR_ACCESS_TOKEN: "synthetic-polar-7c8dd46cd294442db3163258",
    POLAR_WEBHOOK_SECRET: "synthetic-webhook-7c8dd46cd294442db3163258",
    RESEND_API_KEY: "synthetic-mail-7c8dd46cd294442db3163258",
    CONFIRMATION_TOKEN_SECRET: "synthetic-confirm-7c8dd46cd294442db3163258",
  };
  for (const schema of [webEnv, apiEnv, workerEnv]) {
    expect(parseEnv(schema, base).EXPORTS_ENABLED).toBe("0");
    expect(() => parseEnv(schema, { ...base, EXPORTS_ENABLED: "1" })).toThrow(
      "S3_ENDPOINT",
    );
    const enabled = {
      ...base,
      EXPORTS_ENABLED: "1",
      S3_ENDPOINT: "https://storage.example",
      S3_REGION: "local",
      S3_BUCKET: "synthetic",
      S3_ACCESS_KEY_ID: "synthetic",
      S3_SECRET_ACCESS_KEY: "synthetic",
    };
    expect(parseEnv(schema, enabled).EXPORTS_ENABLED).toBe("1");
    expect(parseEnv(schema, enabled).QR_EXPORTS_ENABLED).toBe("0");
    for (const key of [
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ])
      expect(() => parseEnv(schema, { ...enabled, [key]: undefined })).toThrow(
        key,
      );
    expect(() =>
      parseEnv(schema, {
        ...enabled,
        NODE_ENV: "production",
        S3_ENDPOINT: "http://storage.example",
      }),
    ).toThrow("S3_ENDPOINT");
  }
});
test("QR export worker defaults off and requires complete private storage configuration", () => {
  const base = {
    ...redirectFixture(),
    LINK_DOMAIN: "shortn.at",
    POLAR_ENVIRONMENT: "sandbox",
  };
  expect(parseEnv(workerEnv, base).QR_EXPORTS_ENABLED).toBe("0");
  expect(() =>
    parseEnv(workerEnv, { ...base, QR_EXPORTS_ENABLED: "1" }),
  ).toThrow("S3_ENDPOINT");
  const configured = {
    ...base,
    QR_EXPORTS_ENABLED: "1",
    APP_URL: "https://app.shortn.at",
    S3_ENDPOINT: "https://storage.example",
    S3_REGION: "local",
    S3_BUCKET: "synthetic",
    S3_ACCESS_KEY_ID: "synthetic",
    S3_SECRET_ACCESS_KEY: "synthetic-secret",
  };
  expect(parseEnv(workerEnv, configured).QR_EXPORTS_ENABLED).toBe("1");
  expect(() =>
    parseEnv(workerEnv, {
      ...configured,
      NODE_ENV: "production",
      S3_ENDPOINT: "http://storage.example",
    }),
  ).toThrow("S3_ENDPOINT");
  expect(() =>
    parseEnv(workerEnv, {
      ...configured,
      NODE_ENV: "production",
      APP_URL: "http://app.shortn.at",
    }),
  ).toThrow("APP_URL");
});
test("QR API exports default off and reject missing storage or insecure production endpoints", () => {
  const base = {
    MONGODB_URL: "mongodb://127.0.0.1:27020",
    MONGODB_DB: "synthetic",
    POLAR_ACCESS_TOKEN: "polar-api-7c8dd46cd294442db3163258",
    POLAR_WEBHOOK_SECRET: "polar-hook-94f9c23ee8624b2cb0b7237e",
    POLAR_ENVIRONMENT: "sandbox",
  };
  expect(parseEnv(apiEnv, base).QR_EXPORTS_ENABLED).toBe("0");
  expect(() => parseEnv(apiEnv, { ...base, QR_EXPORTS_ENABLED: "1" })).toThrow(
    "S3_ENDPOINT",
  );
  const enabled = {
    ...base,
    QR_EXPORTS_ENABLED: "1",
    S3_ENDPOINT: "https://storage.example",
    S3_REGION: "local",
    S3_BUCKET: "synthetic",
    S3_ACCESS_KEY_ID: "synthetic",
    S3_SECRET_ACCESS_KEY: "synthetic",
  };
  expect(parseEnv(apiEnv, enabled).QR_EXPORTS_ENABLED).toBe("1");
  expect(() =>
    parseEnv(apiEnv, {
      ...enabled,
      NODE_ENV: "production",
      S3_ENDPOINT: "http://storage.example",
    }),
  ).toThrow("S3_ENDPOINT");
});
test("QR dashboard exports require private storage and secure production delivery", () => {
  const base = {
    ...redirectFixture(),
    BETTER_AUTH_SECRET: "synthetic-auth-7c8dd46cd294442db3163258",
    BETTER_AUTH_URL: "https://app.shortn.at",
    POLAR_ACCESS_TOKEN: "synthetic-polar-7c8dd46cd294442db3163258",
    POLAR_ENVIRONMENT: "sandbox",
    RESEND_API_KEY: "synthetic-mail-7c8dd46cd294442db3163258",
    CONFIRMATION_TOKEN_SECRET: "synthetic-confirm-7c8dd46cd294442db3163258",
  };
  expect(parseEnv(webEnv, base).QR_EXPORTS_ENABLED).toBe("0");
  expect(() => parseEnv(webEnv, { ...base, QR_EXPORTS_ENABLED: "1" })).toThrow(
    "S3_ENDPOINT",
  );
  const enabled = {
    ...base,
    QR_EXPORTS_ENABLED: "1",
    S3_ENDPOINT: "https://storage.example",
    S3_REGION: "local",
    S3_BUCKET: "synthetic",
    S3_ACCESS_KEY_ID: "synthetic",
    S3_SECRET_ACCESS_KEY: "synthetic",
  };
  expect(parseEnv(webEnv, enabled).QR_EXPORTS_ENABLED).toBe("1");
  for (const key of [
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ])
    expect(() => parseEnv(webEnv, { ...enabled, [key]: undefined })).toThrow(
      key,
    );
  expect(() =>
    parseEnv(webEnv, {
      ...enabled,
      NODE_ENV: "production",
      S3_ENDPOINT: "http://storage.example",
    }),
  ).toThrow("S3_ENDPOINT");
});
test("CSV import dashboard has an independent flag and requires complete private storage", () => {
  const base = {
    ...redirectFixture(),
    BETTER_AUTH_SECRET: "synthetic-auth-7c8dd46cd294442db3163258",
    BETTER_AUTH_URL: "https://app.shortn.at",
    POLAR_ACCESS_TOKEN: "synthetic-polar-7c8dd46cd294442db3163258",
    POLAR_ENVIRONMENT: "sandbox",
    RESEND_API_KEY: "synthetic-mail-7c8dd46cd294442db3163258",
    CONFIRMATION_TOKEN_SECRET: "synthetic-confirm-7c8dd46cd294442db3163258",
  };
  expect(parseEnv(webEnv, base).IMPORTS_ENABLED).toBe("0");
  expect(() => parseEnv(webEnv, { ...base, IMPORTS_ENABLED: "1" })).toThrow(
    "S3_ENDPOINT",
  );
  const enabled = {
    ...base,
    IMPORTS_ENABLED: "1",
    S3_ENDPOINT: "https://storage.example",
    S3_REGION: "local",
    S3_BUCKET: "synthetic",
    S3_ACCESS_KEY_ID: "synthetic",
    S3_SECRET_ACCESS_KEY: "synthetic",
  };
  expect(parseEnv(webEnv, enabled).IMPORTS_ENABLED).toBe("1");
  expect(parseEnv(webEnv, enabled).QR_EXPORTS_ENABLED).toBe("0");
  for (const key of [
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ])
    expect(() => parseEnv(webEnv, { ...enabled, [key]: undefined })).toThrow(
      key,
    );
  expect(() =>
    parseEnv(webEnv, {
      ...enabled,
      NODE_ENV: "production",
      S3_ENDPOINT: "http://storage.example",
    }),
  ).toThrow("S3_ENDPOINT");
});
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
test("production API starts without Redis and still rejects reused secrets", () => {
  const fixture = {
    NODE_ENV: "production",
    MONGODB_URL: "mongodb://127.0.0.1:27017",
    MONGODB_DB: "fixture",
    POLAR_ENVIRONMENT: "sandbox",
    POLAR_ACCESS_TOKEN: "polar-api-7c8dd46cd294442db3163258",
    POLAR_WEBHOOK_SECRET: "polar-hook-94f9c23ee8624b2cb0b7237e",
  };
  expect(apiEnv.safeParse(fixture).success).toBe(true);
  expect(
    apiEnv.safeParse({
      ...fixture,
      POLAR_WEBHOOK_SECRET: fixture.POLAR_ACCESS_TOKEN,
    }).success,
  ).toBe(false);
});
test("REST mounting is disabled by default and requires pepper and separate Redis in production", () => {
  const fixture = {
    NODE_ENV: "production",
    MONGODB_URL: "mongodb://127.0.0.1:27017",
    MONGODB_DB: "fixture",
    POLAR_ENVIRONMENT: "sandbox",
    POLAR_ACCESS_TOKEN: "polar-api-7c8dd46cd294442db3163258",
    POLAR_WEBHOOK_SECRET: "polar-hook-94f9c23ee8624b2cb0b7237e",
  };
  const disabled = apiEnv.parse(fixture);
  expect(disabled.PLATFORM_API_ENABLED).toBe("0");
  expect(disabled.PLATFORM_API_ROLLOUT).toBe(0);
  expect(
    apiEnv.safeParse({ ...fixture, PLATFORM_API_ENABLED: "1" }).success,
  ).toBe(false);
  const enabled = {
    ...fixture,
    PLATFORM_API_ENABLED: "1",
    API_KEY_PEPPER: "api-pepper-7c8dd46cd294442db3163258",
    REDIS_CACHE_URL: "redis://127.0.0.1:6380",
    REDIS_DURABLE_URL: "redis://127.0.0.1:6379",
  };
  expect(apiEnv.safeParse(enabled).success).toBe(true);
  expect(
    apiEnv.safeParse({ ...enabled, REDIS_DURABLE_URL: enabled.REDIS_CACHE_URL })
      .success,
  ).toBe(false);
  expect(
    apiEnv.safeParse({ ...enabled, PLATFORM_API_ROLLOUT: "101" }).success,
  ).toBe(false);
});
test("href environment URLs require http(s)", () => {
  expect(
    webEnv.shape.BETTER_AUTH_URL.safeParse("javascript:alert(1)").success,
  ).toBe(false);
  expect(
    redirectEnv.shape.PUBLIC_ORIGIN.safeParse("data:text/plain,foo").success,
  ).toBe(false);
  expect(apiEnv.shape.POLAR_ENVIRONMENT.safeParse("production").success).toBe(
    true,
  );
});
test("MCP mounting requires a canonical HTTPS origin, pepper and Redis independently of REST", () => {
  const fixture = {
    NODE_ENV: "production",
    MONGODB_URL: "mongodb://127.0.0.1:27017",
    MONGODB_DB: "fixture",
    POLAR_ENVIRONMENT: "sandbox",
    POLAR_ACCESS_TOKEN: "polar-api-7c8dd46cd294442db3163258",
    POLAR_WEBHOOK_SECRET: "polar-hook-94f9c23ee8624b2cb0b7237e",
  };
  expect(apiEnv.parse(fixture).PLATFORM_MCP_ENABLED).toBe("0");
  expect(apiEnv.parse(fixture).PLATFORM_MCP_ROLLOUT).toBe(0);
  expect(
    apiEnv.safeParse({ ...fixture, PLATFORM_MCP_ENABLED: "1" }).success,
  ).toBe(false);
  const enabled = {
    ...fixture,
    PLATFORM_MCP_ENABLED: "1",
    MCP_PUBLIC_ORIGIN: "https://api.shortn.at",
    API_KEY_PEPPER: "mcp-pepper-7c8dd46cd294442db3163258",
    REDIS_CACHE_URL: "redis://127.0.0.1:6380",
    REDIS_DURABLE_URL: "redis://127.0.0.1:6379",
  };
  expect(apiEnv.safeParse(enabled).success).toBe(true);
  expect(
    apiEnv.safeParse({ ...enabled, MCP_PUBLIC_ORIGIN: "http://api.shortn.at" })
      .success,
  ).toBe(false);
  expect(
    apiEnv.safeParse({ ...enabled, MCP_PUBLIC_ORIGIN: undefined }).success,
  ).toBe(false);
  expect(
    apiEnv.safeParse({ ...enabled, PLATFORM_MCP_ROLLOUT: "101" }).success,
  ).toBe(false);
  expect(
    apiEnv.safeParse({ ...enabled, REDIS_DURABLE_URL: enabled.REDIS_CACHE_URL })
      .success,
  ).toBe(false);
});
test("MCP OAuth requires explicit resource and issuer configuration", () => {
  expect(webEnv.shape.MCP_OAUTH_ENABLED.parse(undefined)).toBe("0");
  const fixture = {
    NODE_ENV: "production",
    MONGODB_URL: "mongodb://127.0.0.1:27017",
    MONGODB_DB: "fixture",
    POLAR_ENVIRONMENT: "sandbox",
    POLAR_ACCESS_TOKEN: "polar-api-7c8dd46cd294442db3163258",
    POLAR_WEBHOOK_SECRET: "polar-hook-94f9c23ee8624b2cb0b7237e",
    PLATFORM_MCP_ENABLED: "1",
    MCP_PUBLIC_ORIGIN: "https://api.shortn.at",
    API_KEY_PEPPER: "oauth-pepper-7c8dd46cd294442db3163258",
    REDIS_CACHE_URL: "redis://127.0.0.1:6380",
    REDIS_DURABLE_URL: "redis://127.0.0.1:6379",
    MCP_OAUTH_ENABLED: "1",
  };
  expect(apiEnv.safeParse(fixture).success).toBe(false);
  expect(
    apiEnv.safeParse({
      ...fixture,
      MCP_OAUTH_ISSUER: "https://app.shortn.at/api/auth",
    }).success,
  ).toBe(true);
  expect(
    apiEnv.safeParse({
      ...fixture,
      MCP_OAUTH_ISSUER: "http://app.shortn.at/api/auth",
    }).success,
  ).toBe(false);
  expect(
    apiEnv.safeParse({
      ...fixture,
      MCP_OAUTH_ISSUER: "https://app.shortn.at/api/auth",
      PLATFORM_MCP_ENABLED: "0",
    }).success,
  ).toBe(false);
});
test("http(s) URLs may be localhost for local development", () => {
  expect(
    webEnv.shape.BETTER_AUTH_URL.safeParse("http://localhost:3000").success,
  ).toBe(true);
  expect(
    webEnv.shape.BETTER_AUTH_URL.safeParse("ftp://example.com").success,
  ).toBe(false);
});

test("blank dotenv entries remain unconfigured", () => {
  const schema = z.object({
    OPTIONAL: z.string().optional(),
    PORT: z.coerce.number().default(3000),
    REQUIRED: z.string().min(1),
  });
  expect(
    parseEnv(schema, { OPTIONAL: "", PORT: "", REQUIRED: "present" }),
  ).toEqual({ PORT: 3000, REQUIRED: "present" });
  expect(() => parseEnv(schema, { REQUIRED: "" })).toThrow("REQUIRED:");
});

test("outgoing webhooks default off and require a distinct recoverable-secret key", () => {
  const api = {
    ...redirectFixture(),
    POLAR_ENVIRONMENT: "sandbox",
    POLAR_ACCESS_TOKEN: "polar-api-token-".repeat(4),
    POLAR_WEBHOOK_SECRET: "polar-webhook-secret-".repeat(3),
  };
  for (const schema of [apiEnv, workerEnv]) {
    const disabled = schema.parse(api);
    expect(disabled.PLATFORM_WEBHOOKS_ENABLED).toBe("0");
    expect(disabled.PLATFORM_WEBHOOKS_ROLLOUT).toBe(0);
    expect(
      schema.safeParse({ ...api, PLATFORM_WEBHOOKS_ENABLED: "1" }).success,
    ).toBe(false);
    const enabled = {
      ...api,
      PLATFORM_WEBHOOKS_ENABLED: "1",
      WEBHOOK_SECRET_KEY: "outgoing-encryption-secret-".repeat(3),
    };
    expect(schema.safeParse(enabled).success).toBe(true);
    expect(
      schema.safeParse({ ...enabled, PLATFORM_WEBHOOKS_ROLLOUT: "101" })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...enabled,
        NODE_ENV: "production",
        WEBHOOK_SECRET_KEY: api.IP_HASH_SECRET,
      }).success,
    ).toBe(false);
  }
});
