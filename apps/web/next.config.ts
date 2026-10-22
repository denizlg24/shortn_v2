import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  // Parallel local sandboxes must not share Next's dev lock or output.
  distDir:
    process.env.NODE_ENV === "development" && process.env.SHORTN_NEXT_DIST_DIR
      ? process.env.SHORTN_NEXT_DIST_DIR
      : ".next",
  output: "standalone",
  // Marketing social images read their font files from disk at request time.
  outputFileTracingIncludes: { "/*": ["src/server/og-fonts/*.woff"] },
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  transpilePackages: [
    "@shortn/auth",
    "@shortn/billing",
    "@shortn/core",
    "@shortn/db",
    "@shortn/emails",
    "@shortn/env",
    "@shortn/redis",
    "@shortn/ui",
  ],
  serverExternalPackages: ["mongodb", "ioredis"],
  poweredByHeader: false,
  // Same-origin on every host the web app answers for (app, shortn.at through
  // the edge, handles, custom domains), which route /_web/* here; legacy owns
  // shortn.at/_next until P7. A path, not an origin: builds are shared between
  // environments, so nothing baked in may vary per environment.
  assetPrefix: "/_web",
  typedRoutes: true,
  // The redirect sends flagged links to /{locale}/safety/{key}; the page
  // lives at /safety/{key} so it can't collide with /[workspace].
  async rewrites() {
    return [
      // Marketing media in public/: the root host routes only /_web/* here.
      {
        source: "/_web/marketing/:file",
        destination: "/marketing/:file",
      },
      {
        source: "/:locale(en|pt|es)/safety/:key/:rest*",
        destination: "/safety/:key/:rest*?locale=:locale",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      {
        source: "/_web/_next/static/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
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
