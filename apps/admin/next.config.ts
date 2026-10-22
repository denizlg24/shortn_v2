import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Nothing here may vary per environment: Forge shares the build cache across
// targets, so env is parsed at runtime and the CSP is built in proxy.ts.
const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  transpilePackages: [
    "@shortn/auth",
    "@shortn/billing",
    "@shortn/core",
    "@shortn/db",
    "@shortn/env",
    "@shortn/redis",
    "@shortn/ui",
  ],
  serverExternalPackages: ["mongodb", "ioredis"],
  poweredByHeader: false,
  typedRoutes: true,
};

export default config;
