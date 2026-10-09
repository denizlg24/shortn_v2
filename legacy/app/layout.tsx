import "./globals.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://shortn.at"),
  title: {
    default: "Shortn - URL Shortener, QR Codes & Link Management",
    template: "%s | Shortn",
  },
  description:
    "Shorten URLs, create custom QR codes, and manage links with powerful analytics. Free URL shortener with branded links, bio pages, campaign tracking, and detailed click analytics.",
  keywords: [
    "url shortener",
    "link shortener",
    "short url",
    "custom url",
    "qr code generator",
    "link management",
    "analytics",
    "bio link",
    "link in bio",
  ],
  authors: [{ name: "Shortn" }],
  creator: "Shortn",
  publisher: "Shortn",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "Shortn",
    title: "Shortn - URL Shortener, QR Codes & Link Management",
    description:
      "Shorten URLs, create custom QR codes, and manage links with powerful analytics. Free URL shortener with branded links, bio pages, and click analytics.",
    url: "https://shortn.at",
    locale: "en_US",
    alternateLocale: ["pt_PT", "es_ES"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shortn - URL Shortener, QR Codes & Link Management",
    description:
      "Shorten URLs, create custom QR codes, and manage links with powerful analytics.",
    site: "@shortn",
    creator: "@shortn",
  },
  alternates: {
    canonical: "https://shortn.at",
    languages: {
      "x-default": "https://shortn.at/en",
      en: "https://shortn.at/en",
      pt: "https://shortn.at/pt",
      es: "https://shortn.at/es",
    },
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
