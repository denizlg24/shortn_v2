import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  transpilePackages: [
    "@shortn/auth",
    "@shortn/core",
    "@shortn/db",
    "@shortn/emails",
    "@shortn/env",
    "@shortn/redis",
    "@shortn/ui",
  ],
  serverExternalPackages: ["mongodb", "ioredis"],
  poweredByHeader: false,
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(config);
