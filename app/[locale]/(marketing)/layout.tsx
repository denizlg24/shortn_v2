import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import "../../globals.css";
import { Header } from "@/components/ui/header";
import { Footer } from "@/components/ui/footer";
import { Toaster } from "@/components/ui/sonner";
import ScrollToTop from "@/utils/ScrollToTop";
import { Manrope, Sora } from "next/font/google";

const marketingSans = Manrope({
  subsets: ["latin"],
  variable: "--font-marketing-sans",
});

const marketingEditorial = Sora({
  subsets: ["latin"],
  variable: "--font-editorial",
  weight: ["400", "500", "600", "700"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata() {
  const t = await getTranslations("metadata");
  const locale = await getLocale();

  return {
    metadataBase: new URL("https://shortn.at"),
    title: t("home.title"),
    description: t("home.description"),
    keywords: t("home.keywords")
      .split(",")
      .map((k) => k.trim()),
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
      title: t("home.title"),
      description: t("home.description"),
      type: "website",
      siteName: "Shortn",
      url: `https://shortn.at/${locale}`,
      locale: locale === "en" ? "en_US" : locale === "pt" ? "pt_PT" : "es_ES",
      alternateLocale: ["en_US", "pt_PT", "es_ES"],
    },
    twitter: {
      card: "summary_large_image",
      title: t("home.title"),
      description: t("home.description"),
      site: "@shortn",
      creator: "@shortn",
    },
    alternates: {
      canonical: `https://shortn.at/${locale}`,
      languages: {
        "x-default": "https://shortn.at/en",
        en: "https://shortn.at/en",
        pt: "https://shortn.at/pt",
        es: "https://shortn.at/es",
      },
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return (
    <html lang={locale}>
      <body
        className={`${marketingSans.variable} ${marketingEditorial.variable} min-h-screen w-full overflow-x-hidden bg-background font-[family-name:var(--font-marketing-sans)] text-foreground antialiased`}
      >
        <NextIntlClientProvider>
          <div className="relative flex min-h-screen w-full flex-col">
            <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#f4efe8_0%,#fbf8f3_24%,#ffffff_62%,#ffffff_100%)]" />
              <div className="absolute left-1/2 top-0 h-[30rem] w-[56rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(22,44,94,0.13),transparent_66%)] blur-3xl" />
              <div className="absolute -left-24 top-40 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(195,127,67,0.11),transparent_70%)] blur-3xl" />
              <div className="absolute -right-16 top-64 h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(76,112,172,0.1),transparent_72%)] blur-3xl" />
            </div>
            <ScrollToTop />
            <Header />
            <div className="flex-1 pt-20 sm:pt-24">{children}</div>
            <Toaster position="top-center" />
            <Footer />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
