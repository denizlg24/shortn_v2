import "server-only";
import { adminEnv, parseEnv } from "@shortn/env";

let parsed: ReturnType<typeof load> | undefined;
const load = () => parseEnv(adminEnv, process.env);

// Parsed on first use: `next build` must not need runtime secrets.
export function env() {
  parsed ??= load();
  return parsed;
}
