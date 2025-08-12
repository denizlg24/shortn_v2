import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../../globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { UserProvider } from "@/utils/UserContext";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { DashboardHeaderClient } from "@/components/ui/dasboard-header-client";
import { getUser } from "@/app/actions/userActions";

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

  const { user } = await getUser();

  return (
    <html lang={locale}>
      <body
        className={`antialiased w-full min-h-screen flex flex-col items-center justify-start sm:pt-14! pt-12!`}
      >
        <UserProvider initialUser={user}>
          <NextIntlClientProvider>
            <SidebarProvider defaultOpen={defaultOpen}>
              <AppSidebar />
              <DashboardHeaderClient />
              {children}
              <Toaster position="top-center" />
            </SidebarProvider>
          </NextIntlClientProvider>
        </UserProvider>
      </body>
    </html>
  );
}
