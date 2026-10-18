import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { shortnMarkPath } from "@shortn/ui";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { legalDocuments } from "@/components/marketing/legal";
import { toLocale } from "@/server/marketing";

const font = (weight: 400 | 800) =>
  readFile(
    join(
      process.cwd(),
      `src/server/og-fonts/schibsted-grotesk-latin-${weight}-normal.woff`,
    ),
  );
const fonts = Promise.all([font(800), font(400)]);

const mark = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 504 504"><rect width="504" height="504" fill="#0f172b" stroke="#ffffff" stroke-opacity="0.25" stroke-width="16"/><g transform="translate(0 505.5) scale(0.1 -0.1)"><path d="${shortnMarkPath}" fill="#ffffff"/></g></svg>`,
)}`;

const headlineKeys = {
  home: "home.hero.title",
  features: "features.title",
  pricing: "pricing.title",
  about: "about.title",
  contact: "contact.title",
} as const;
const isHeadlinePage = (page: string): page is keyof typeof headlineKeys =>
  page in headlineKeys;
const isLegalPage = (page: string): page is keyof typeof legalDocuments =>
  page in legalDocuments;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; page: string }> },
) {
  const { locale: raw, page } = await params;
  const locale = toLocale(raw);
  if (!locale || (!isHeadlinePage(page) && !isLegalPage(page)))
    return new Response("Not found", { status: 404 });
  const t = await getTranslations({ locale, namespace: "marketing" });
  const headline = isHeadlinePage(page)
    ? t(headlineKeys[page])
    : legalDocuments[page].title;
  const [bold, regular] = await fonts;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#0f172b",
        color: "#f8fafc",
        fontFamily: "Schibsted Grotesk",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <img
          src={mark}
          width={64}
          height={64}
          alt=""
          style={{ borderRadius: 8 }}
        />
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
          Shortn
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: headline.length > 48 ? 72 : 88,
          fontWeight: 800,
          lineHeight: 1.02,
          letterSpacing: -3,
          maxWidth: 1000,
        }}
      >
        {headline}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 400,
          color: "rgba(226,232,240,0.82)",
        }}
      >
        shortn.at
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Schibsted Grotesk", data: bold, weight: 800, style: "normal" },
        {
          name: "Schibsted Grotesk",
          data: regular,
          weight: 400,
          style: "normal",
        },
      ],
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
