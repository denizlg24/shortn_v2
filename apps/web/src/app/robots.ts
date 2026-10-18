import type { MetadataRoute } from "next";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

// AI crawlers stay allowed on marketing and docs (10).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/_bio/",
        "/en/dashboard/",
        "/pt/dashboard/",
        "/es/dashboard/",
      ],
    },
    sitemap: new URL("/sitemap.xml", env().PUBLIC_ORIGIN).toString(),
  };
}
