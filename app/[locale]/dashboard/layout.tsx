import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../../globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { cookies } from "next/headers";
import { DashboardHeader } from "@/components/ui/dashboard-header";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("home.title"),
    description: t("home.description"),
    keywords: t("home.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("home.title"),
      description: t("home.description"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("home.title"),
      description: t("home.description"),
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

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <html lang={locale}>
      <body
        className={`antialiased w-full min-h-screen flex flex-col items-center justify-start pt-14`}
      >
        <NextIntlClientProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar />
            <DashboardHeader />
            {children}
          </SidebarProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
