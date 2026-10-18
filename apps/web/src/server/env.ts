import "server-only";
import { parseEnv, webEnv } from "@shortn/env";

let parsed: ReturnType<typeof load> | undefined;
const load = () => parseEnv(webEnv, process.env);

// Parsed on first use, not at import: `next build` evaluates route modules
// and must not need runtime secrets or a database.
export function env() {
  parsed ??= load();
  return parsed;
}
