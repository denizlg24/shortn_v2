import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { legalDocuments } from "@/components/marketing/legal";
import { LegalPage } from "@/components/marketing/legal-page";
import { marketingMetadata, toLocale } from "@/server/marketing";

export async function generateMetadata({
  params,
}: PageProps<"/_marketing/[locale]/terms">): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return locale ? marketingMetadata(locale, "terms") : {};
}

export default async function TermsPage({
  params,
}: PageProps<"/_marketing/[locale]/terms">) {
  const locale = toLocale((await params).locale);
  if (!locale) notFound();
  const t = await getTranslations({ locale, namespace: "marketing.legal" });
  return (
    <LegalPage
      locale={locale}
      document={legalDocuments.terms}
      notice={t("authoritative")}
    />
  );
}
