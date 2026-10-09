import { expect, test } from "bun:test";
import { z } from "zod";
import {
  apiEnv,
  envExample,
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
  for (const schema of [webEnv, redirectEnv, apiEnv, workerEnv])
    for (const key of Object.keys(schema.shape))
      expect(envExample()).toContain(`${key}=`);
  expect(envExample()).not.toContain("STRIPE_");
});
