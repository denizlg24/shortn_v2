import {
  MarketingCtaBand,
  MarketingHero,
  MarketingPage,
  MarketingSection,
  PrimaryActionLink,
} from "@/components/marketing/marketing-primitives";
import { HelpSearch } from "@/components/marketing/help-search";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("help.title"),
    description: t("help.description"),
    keywords: t("help.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("help.title"),
      description: t("help.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("help.title"),
      description: t("help.description"),
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
  const t = await getTranslations("help");

  const categories = [
    {
      href: "/help/articles/getting-started",
      title: t("category-cards.getting-started.title"),
      description: t("category-cards.getting-started.description"),
    },
    {
      href: "/help/articles/links/creating-links",
      title: t("category-cards.links.title"),
      description: t("category-cards.links.description"),
    },
    {
      href: "/help/articles/qr-codes/creating-qr-codes",
      title: t("category-cards.qr-codes.title"),
      description: t("category-cards.qr-codes.description"),
    },
    {
      href: "/help/articles/billing/plans-pricing",
      title: t("category-cards.billing.title"),
      description: t("category-cards.billing.description"),
    },
  ];

  const popularArticles = [
    {
      href: "/help/articles/getting-started",
      title: t("articles.getting-started.title"),
      description: t("articles.getting-started.description"),
    },
    {
      href: "/help/articles/links/creating-links",
      title: t("articles.creating-links.title"),
      description: t("articles.creating-links.description"),
    },
    {
      href: "/help/articles/analytics/understanding-analytics",
      title: t("articles.understanding-analytics.title"),
      description: t("articles.understanding-analytics.description"),
    },
    {
      href: "/help/articles/qr-codes/creating-qr-codes",
      title: t("articles.creating-qr-codes.title"),
      description: t("articles.creating-qr-codes.description"),
    },
    {
      href: "/help/articles/bio-pages/creating-bio-pages",
      title: t("articles.creating-bio-pages.title"),
      description: t("articles.creating-bio-pages.description"),
    },
    {
      href: "/help/articles/billing/plans-pricing",
      title: t("articles.plans-pricing.title"),
      description: t("articles.plans-pricing.description"),
    },
  ];

  return (
    <MarketingPage>
      <MarketingHero
        title={t("title")}
        subtitle={t("subtitle")}
        aside={<HelpSearch />}
      />

      <MarketingSection>
        <div className="grid gap-5 md:grid-cols-2">
          {categories.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className="grid gap-3 border-t border-primary/10 py-5 transition-colors hover:text-primary"
            >
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-[family-name:var(--font-editorial)] text-3xl leading-none tracking-[-0.04em]">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary/70" />
              </div>
            </Link>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        title={t("popular-articles")}
        description={t("subtitle")}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {popularArticles.map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="border-t border-primary/10 py-5 transition-colors hover:text-primary"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-[family-name:var(--font-editorial)] text-3xl leading-none tracking-[-0.04em]">
                    {article.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {article.description}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary/70" />
              </div>
            </Link>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title={t("all-categories")}>
        <div className="grid gap-8 lg:grid-cols-3">
          {[
            {
              title: t("category-cards.links.title"),
              links: [
                {
                  href: "/help/articles/links/creating-links",
                  label: t("articles.creating-links.title"),
                },
                {
                  href: "/help/articles/links/managing-links",
                  label: t("articles.managing-links"),
                },
                {
                  href: "/help/articles/links/utm-parameters",
                  label: t("articles.utm-parameters"),
                },
              ],
            },
            {
              title: t("category-cards.qr-codes.title"),
              links: [
                {
                  href: "/help/articles/qr-codes/creating-qr-codes",
                  label: t("articles.creating-qr-codes.title"),
                },
                {
                  href: "/help/articles/qr-codes/managing-qr-codes",
                  label: t("articles.managing-qr-codes"),
                },
              ],
            },
            {
              title: t("category-cards.bio-pages.title"),
              links: [
                {
                  href: "/help/articles/bio-pages/creating-bio-pages",
                  label: t("articles.creating-bio-pages.title"),
                },
                {
                  href: "/help/articles/bio-pages/customizing-bio-pages",
                  label: t("articles.customizing-bio-pages"),
                },
              ],
            },
            {
              title: t("category-cards.analytics.title"),
              links: [
                {
                  href: "/help/articles/analytics/understanding-analytics",
                  label: t("articles.understanding-analytics.title"),
                },
              ],
            },
            {
              title: t("category-cards.campaigns.title"),
              links: [
                {
                  href: "/help/articles/campaigns/organizing-campaigns",
                  label: t("articles.organizing-campaigns"),
                },
              ],
            },
            {
              title: t("category-cards.billing.title"),
              links: [
                {
                  href: "/help/articles/billing/plans-pricing",
                  label: t("articles.plans-pricing.title"),
                },
                {
                  href: "/help/articles/billing/upgrading-plans",
                  label: t("articles.upgrading-plans"),
                },
              ],
            },
          ].map((category) => (
            <div
              key={category.title}
              className="border-t border-primary/10 pt-5"
            >
              <h3 className="font-[family-name:var(--font-editorial)] text-3xl leading-none tracking-[-0.04em]">
                {category.title}
              </h3>
              <div className="mt-5 flex flex-col gap-3">
                {category.links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm leading-7 text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title={t("still-need-help.title")}
        subtitle={t("still-need-help.subtitle")}
        actions={
          <PrimaryActionLink href="/contact">
            {t("still-need-help.contact-us")}
          </PrimaryActionLink>
        }
      />
    </MarketingPage>
  );
}
