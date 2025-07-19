import { z } from "zod";

const envSchema = z.object({
    MONGODB_KEY: z.string().nonempty(),
    STRIPE_SECRET_KEY: z.string().nonempty(),
    AUTH_SECRET: z.string().nonempty(),
    AUTH_GOOGLE_ID: z.string().nonempty(),
    AUTH_GOOGLE_SECRET: z.string().nonempty(),
    FREE_PLAN_ID: z.string().nonempty(),
    BASIC_PLAN_ID: z.string().nonempty(),
    PLUS_PLAN_ID: z.string().nonempty(),
    PRO_PLAN_ID: z.string().nonempty(),
    WEBMAIL_USER: z.string().nonempty(),
    WEBMAIL_PASS: z.string().nonempty(),
    PINATA_JWT: z.string().nonempty(),
    PINATA_GATEWAY: z.string().nonempty()
});

export default envSchema.parse(process.env);