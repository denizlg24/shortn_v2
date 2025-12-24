import { z } from "zod";

const envSchema = z.object({
  MONGODB_KEY: z.string().nonempty(),
  AUTH_SECRET: z.string().nonempty(),
  AUTH_GITHUB_ID: z.string().nonempty(),
  AUTH_GITHUB_SECRET: z.string().nonempty(),
  AUTH_GOOGLE_ID: z.string().nonempty(),
  AUTH_GOOGLE_SECRET: z.string().nonempty(),
  FREE_PLAN_ID: z.string().nonempty(),
  BASIC_PLAN_ID: z.string().nonempty(),
  PLUS_PLAN_ID: z.string().nonempty(),
  PRO_PLAN_ID: z.string().nonempty(),
  WEBMAIL_USER: z.string().nonempty(),
  WEBMAIL_PASS: z.string().nonempty(),
  PINATA_JWT: z.string().nonempty(),
  PINATA_GATEWAY: z.string().nonempty(),
  LEVEL_ONE_UPGRADE_ID: z.string().nonempty(),
  LEVEL_TWO_UPGRADE_ID: z.string().nonempty(),
  EMAIL_TOKEN_SUFFIX: z.string().nonempty(),
  RESEND_API_KEY: z.string().nonempty(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  POLAR_ACCESS_TOKEN: z.string().nonempty().optional(),
  POLAR_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  POLAR_WEBHOOK_SECRET: z.string().nonempty().optional(),
  QSTASH_URL: z.string().url().optional(),
  QSTASH_TOKEN: z.string().nonempty().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().nonempty().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().nonempty().optional(),
  ATLAS_SEARCH_INDEX_LINKS: z.string().nonempty().optional(),
  ATLAS_SEARCH_INDEX_QR_CODES: z.string().nonempty().optional(),
});

export default envSchema.parse(process.env);
