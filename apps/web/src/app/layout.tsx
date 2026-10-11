import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { UIProvider } from "@/components/ui-provider";
import type { Locale } from "@/i18n/locale";
import { themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "Shortn", template: "%s · Shortn" },
  robots: { index: false, follow: false },
};

const htmlLang: Record<Locale, string> = { en: "en", pt: "pt-PT", es: "es" };

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={htmlLang[locale]} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-fg antialiased">
        <NextIntlClientProvider>
          <UIProvider>{children}</UIProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
