import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PublicFrame, PublicMessage } from "@/components/public/public-frame";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("metaTitle") };
}

// Unmatched URLs, and workspaces the user can't open: the workspace layout
// calls notFound() itself, so its own boundary can't catch that case.
export default async function NotFound() {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations("notFound"),
    getTranslations("common"),
    getLocale(),
  ]);
  return (
    <PublicFrame locale={locale} brand={tCommon("brand")}>
      <PublicMessage
        title={t("page.title")}
        description={t("page.body")}
        action={{ href: "/", label: t("page.action") }}
      />
    </PublicFrame>
  );
}
