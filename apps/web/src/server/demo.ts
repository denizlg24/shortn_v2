import "server-only";
import { env } from "./env";

/** The hero falls back to a plain sign-up CTA unless the demo is fully configured. */
export function demoConfig() {
  const config = env();
  if (
    config.MARKETING_DEMO_ENABLED !== "1" ||
    !config.TURNSTILE_SITE_KEY ||
    !config.TURNSTILE_SECRET_KEY
  )
    return null;
  return {
    siteKey: config.TURNSTILE_SITE_KEY,
    secretKey: config.TURNSTILE_SECRET_KEY,
    dailyCap: config.MARKETING_DEMO_DAILY_CAP,
  };
}
