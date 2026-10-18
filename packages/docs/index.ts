import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import generated from "./generated.json";

export type DocumentationPage = {
  title: string;
  markdown: string;
  html: string;
  /** Set on user guides, which exist in every locale. */
  locale?: "en" | "pt" | "es";
  guide?: string;
};
export const documentation = generated as {
  spec: Record<string, unknown>;
  pages: Record<string, DocumentationPage>;
  index: string;
  full: string;
};
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const htmlLang = { en: "en", pt: "pt-PT", es: "es" } as const;
const guideHref = (locale: string, guide: string) =>
  guide ? `/docs/${locale}/guides/${guide}` : `/docs/${locale}/guides`;

function pageHtml(page: DocumentationPage, path: string, origin?: string) {
  const absolute = (href: string) =>
    origin ? new URL(href, origin).toString() : href;
  const head = [`<link rel="canonical" href="${escape(absolute(path))}">`];
  if (page.locale && page.guide !== undefined) {
    const guide = page.guide;
    for (const locale of Object.keys(htmlLang).filter((locale) =>
      Object.hasOwn(
        documentation.pages,
        guide ? `${locale}/guides/${guide}` : `${locale}/guides`,
      ),
    ))
      head.push(
        `<link rel="alternate" hreflang="${locale}" href="${escape(absolute(guideHref(locale, guide)))}">`,
      );
    head.push(
      `<link rel="alternate" hreflang="x-default" href="${escape(absolute(guideHref("en", guide)))}">`,
    );
  }
  const guides = guideHref(page.locale ?? "en", "");
  return `<!doctype html><html lang="${page.locale ? htmlLang[page.locale] : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${escape(page.title)} · Shortn</title>${head.join("")}<link rel="alternate" type="text/markdown" href="${escape(path)}.md"><style>
  :root{color-scheme:light dark;font:17px/1.65 system-ui,sans-serif}body{max-width:76ch;margin:0 auto;padding:24px}a{color:light-dark(#1755aa,#90bdff)}nav{display:flex;gap:20px;flex-wrap:wrap;border-bottom:1px solid #8885;padding-bottom:16px}h1,h2,h3{line-height:1.25;margin-top:1.8em}pre{overflow:auto;background:#8881;padding:16px;border-radius:8px}code{font-size:.88em;overflow-wrap:anywhere}table{display:block;overflow:auto;border-collapse:collapse}td,th{padding:8px;border:1px solid #8885}main{overflow-wrap:anywhere}a:focus-visible{outline:3px solid currentColor;outline-offset:4px}@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
  </style></head><body><nav aria-label="Documentation"><a href="/docs">Shortn docs</a><a href="${guides}">Guides</a><a href="/docs/api">API reference</a><a href="${escape(path)}.md">Markdown</a></nav><main>${page.html}</main></body></html>`;
}

/** Public, credential-free docs. The API retains its live OpenAPI generation. */
export function createDocumentationApp(
  options: {
    liveSpec?: boolean;
    apiRoot?: boolean;
    apiOrigin?: string;
    /** Root site origin for canonical and hreflang URLs. */
    publicOrigin?: string | undefined;
  } = {},
) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Cache-Control", "public, max-age=300");
  });
  const reference = Scalar({
    url: "/openapi.json",
    pageTitle: "Shortn API reference",
    persistAuth: false,
    telemetry: false,
  });
  app.get("/docs/api", reference);
  if (options.apiRoot) app.get("/docs", reference);
  if (!options.liveSpec)
    app.get("/openapi.json", (c) => {
      const request = new URL(c.req.url);
      const origin =
        options.apiOrigin ??
        (options.apiRoot
          ? request.origin
          : request.hostname === "staging.shortn.at"
            ? "https://api-staging.shortn.at"
            : "https://api.shortn.at");
      return c.json({ ...documentation.spec, servers: [{ url: origin }] });
    });
  app.get("/llms.txt", (c) =>
    c.body(documentation.index, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
    }),
  );
  app.get("/llms-full.txt", (c) =>
    c.body(documentation.full, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
    }),
  );
  for (const [slug, page] of Object.entries(documentation.pages)) {
    const path = slug === "index" ? "/docs" : `/docs/${slug}`;
    app.get(`${path}.md`, (c) =>
      c.body(page.markdown, 200, {
        "Content-Type": "text/markdown; charset=utf-8",
      }),
    );
    if (slug !== "api")
      app.get(path, (c) => c.html(pageHtml(page, path, options.publicOrigin)));
  }
  return app;
}
