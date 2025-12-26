import { ProfileCard } from "@/components/dashboard/settings/profile-card";
import { getServerSession } from "@/lib/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("settings.title"),
    description: t("settings.description"),
    keywords: t("settings.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("settings.title"),
      description: t("settings.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("settings.title"),
      description: t("settings.description"),
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    notFound();
  }
  return <ProfileCard initialUser={user} />;
}
