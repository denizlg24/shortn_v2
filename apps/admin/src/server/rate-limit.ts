import "server-only";
import { consumeAuthRateLimit } from "@shortn/auth/rate-limit";
import { cacheRedis } from "./redis";

const rules = {
  read: { window: 60, max: 600 },
  mutate: { window: 60, max: 60 },
  sensitive: { window: 60, max: 10 },
  bulk: { window: 600, max: 5 },
} as const;

export type RateClass = keyof typeof rules;

/** 23 §1.5. Reads fail open when Redis is down; mutations fail closed. */
export async function consumeAdminRate(adminId: string, rateClass: RateClass) {
  try {
    const result = await consumeAuthRateLimit(
      cacheRedis(),
      `admin:${rateClass}:${adminId}`,
      rules[rateClass],
    );
    return result.allowed;
  } catch {
    return rateClass === "read";
  }
}
