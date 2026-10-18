import { cn } from "@shortn/ui";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductShot } from "@/components/marketing/product-shot";
import {
  ClosingBand,
  Container,
  PageHead,
  Points,
  SectionHeading,
} from "@/components/marketing/section";
import type { ShotName } from "@/components/marketing/shots";
import { appHref, marketingMetadata, toLocale } from "@/server/marketing";

export async function generateMetadata({
  params,
}: PageProps<"/_marketing/[locale]/features">): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return locale ? marketingMetadata(locale, "features") : {};
}

// Anchor ids are stable across locales: the legacy product pages 301 to them.
const sections = [
  {
    id: "links",
    key: "links",
    points: [
      "links.points.keys",
      "links.points.rules",
      "links.points.targeting",
      "links.points.rotation",
      "links.points.deepLinks",
      "links.points.passwords",
      "links.points.utm",
      "links.points.trash",
    ],
    shot: "linkRules",
  },
  {
    id: "qr-codes",
    key: "qr",
    points: [
      "qr.points.formats",
      "qr.points.print",
      "qr.points.style",
      "qr.points.bulk",
    ],
    shot: "qrDesign",
  },
  {
    id: "bio-pages",
    key: "bio",
    points: [
      "bio.points.blocks",
      "bio.points.themes",
      "bio.points.drafts",
      "bio.points.domains",
    ],
    shot: "bioEditor",
  },
  {
    id: "campaigns",
    key: "campaigns",
    points: [
      "campaigns.points.utm",
      "campaigns.points.results",
      "campaigns.points.export",
    ],
    shot: "campaign",
  },
  {
    id: "analytics",
    key: "analytics",
    points: [
      "analytics.points.breakdowns",
      "analytics.points.scans",
      "analytics.points.exports",
      "analytics.points.privacy",
    ],
    shot: "analytics",
  },
  {
    id: "teams",
    key: "teams",
    points: [
      "teams.points.roles",
      "teams.points.security",
      "teams.points.sso",
      "teams.points.imports",
    ],
    shot: "members",
  },
  {
    id: "developers",
    key: "developers",
    points: [
      "developers.points.api",
      "developers.points.webhooks",
      "developers.points.mcp",
      "developers.points.llms",
    ],
    shot: "webhooks",
  },
  {
    id: "safety",
    key: "safety",
    points: [
      "safety.points.scanning",
      "safety.points.interstitial",
      "safety.points.reports",
    ],
    shot: "safety",
  },
] as const satisfies readonly {
  id: string;
  key: string;
  points: readonly string[];
  shot: ShotName;
}[];

export default async function FeaturesPage({
  params,
}: PageProps<"/_marketing/[locale]/features">) {
  const locale = toLocale((await params).locale);
  if (!locale) notFound();
  const [t, tShots] = await Promise.all([
    getTranslations({ locale, namespace: "marketing.features" }),
    getTranslations({ locale, namespace: "marketing.shots" }),
  ]);
  return (
    <>
      <PageHead title={t("title")} intro={t("intro")} />
      <Container className="grid gap-10 py-14 md:py-20 lg:grid-cols-12 lg:gap-12">
        <nav
          aria-labelledby="features-toc"
          className="lg:sticky lg:top-8 lg:col-span-3 lg:self-start"
        >
          <h2
            id="features-toc"
            className="text-small font-semibold text-fg-muted"
          >
            {t("toc")}
          </h2>
          <ol className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-0 lg:border-l lg:border-line">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex h-9 items-center rounded-control border border-line px-3 text-body text-fg-muted transition-colors hover:text-fg lg:-ml-px lg:h-8 lg:rounded-none lg:border-0 lg:border-l lg:border-transparent lg:pl-4 lg:hover:border-fg"
                >
                  {t(`${section.key}.nav`)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex flex-col lg:col-span-9">
          {sections.map((section, index) => (
            <section
              key={section.id}
              aria-labelledby={section.id}
              className={cn(
                "flex flex-col gap-8 py-14 first:pt-0",
                index > 0 && "border-t border-line",
              )}
            >
              <SectionHeading
                id={section.id}
                title={t(`${section.key}.title`)}
                body={t(`${section.key}.body`)}
              />
              <Points
                className="md:grid md:grid-cols-2 md:gap-x-8 md:border-t-0 [&>li]:md:border-t-0"
                items={section.points.map((point) => t(point))}
              />
              {section.id === "developers" ? (
                <a
                  href="/docs/api"
                  className="group inline-flex items-center gap-1.5 self-start text-emphasis font-medium text-signal"
                >
                  {t("developers.cta")}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              ) : null}
              <ProductShot
                name={section.shot}
                alt={tShots(section.shot)}
                caption={index === 0}
              />
            </section>
          ))}
        </div>
      </Container>
      <ClosingBand
        title={t("cta.title")}
        body={t("cta.body")}
        primary={{ href: appHref("/register"), label: t("cta.primary") }}
        secondary={{ href: `/${locale}/pricing`, label: t("cta.secondary") }}
      />
    </>
  );
}
