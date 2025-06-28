import { z } from "zod";

const envSchema = z.object({
    AUTH_SECRET: z.string().nonempty(),
    MONGODB_KEY: z.string().nonempty()
});

export default envSchema.parse(process.env);