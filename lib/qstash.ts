import { Client } from "@upstash/qstash";
import env from "@/utils/env";

export const qstashClient = new Client({
  token: env.QSTASH_TOKEN,
});
