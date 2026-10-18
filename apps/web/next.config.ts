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
  // Pages the edge Worker serves on shortn.at (password, safety) load their
  // assets from the web origin itself; legacy owns shortn.at/_next until P7.
  ...(process.env.WEB_ASSET_ORIGIN
    ? { assetPrefix: process.env.WEB_ASSET_ORIGIN }
    : {}),
  typedRoutes: true,
  // The redirect sends flagged links to /{locale}/safety/{key}; the page
  // lives at /safety/{key} so it can't collide with /[workspace].
  async rewrites() {
    return [
      {
        source: "/:locale(en|pt|es)/safety/:key/:rest*",
        destination: "/safety/:key/:rest*?locale=:locale",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/_bio/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${process.env.WEB_ASSET_ORIGIN ?? ""}; font-src 'self' https://fonts.gstatic.com ${process.env.WEB_ASSET_ORIGIN ?? ""}; script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""} ${process.env.WEB_ASSET_ORIGIN ?? ""}; connect-src 'self' ${process.env.BIO_API_ORIGIN ?? ""}; frame-src https://www.youtube-nocookie.com https://open.spotify.com https://player.vimeo.com https://w.soundcloud.com https://embed.music.apple.com; form-action 'none'`,
          },
        ],
      },
      {
        source: "/_next/static/:path*",
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
