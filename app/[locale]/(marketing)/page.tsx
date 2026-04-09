import {
  MarketingCtaBand,
  MarketingHero,
  MarketingPage,
  MarketingSection,
  PrimaryActionLink,
  SecondaryActionLink,
} from "@/components/marketing/marketing-primitives";
import { RotatingSubtitle } from "./_components/rotating-subtitle";
import {
  BarChart3,
  Check,
  Globe,
  Link2,
  QrCode,
  Shield,
  Zap,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("homepage");
  const tRotating = await getTranslations("rotating-subtitle");
  const tHeader = await getTranslations("header");
  const heroFeatures = [
    {
      icon: <Link2 className="h-4 w-4" />,
      title: t("features.shorten-links.title"),
      description: t("features.shorten-links.description"),
    },
    {
      icon: <QrCode className="h-4 w-4" />,
      title: t("features.qr-codes.title"),
      description: t("features.qr-codes.description"),
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      title: t("features.analytics.title"),
      description: t("features.analytics.description"),
    },
  ];
  const heroChecks = [
    t("no-credit-card"),
    t("no-onboarding"),
    t("free-forever"),
  ];
  const heroStats = [
    {
      value: t("stats.affordable-value"),
      label: t("stats.affordable-label"),
    },
    { value: t("stats.uptime-value"), label: t("stats.uptime-label") },
    { value: t("stats.links-value"), label: t("stats.links-label") },
  ];

  return (
    <MarketingPage>
      <MarketingHero
        title={t("hero-title")}
        subtitle={t("hero-subtitle")}
        actions={
          <>
            <PrimaryActionLink href="/register">
              {t("get-started-free")} {t("free")}
            </PrimaryActionLink>
            <SecondaryActionLink href="/pricing">
              {t("compare-plans")}
            </SecondaryActionLink>
          </>
        }
        aside={
          <div className="mx-auto max-w-5xl border-y border-black/5 py-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(0,0.8fr))]">
              <div className="space-y-4 text-left">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Shortn.at
                </p>
                <div className="font-[family-name:var(--font-editorial)] text-4xl font-semibold leading-[0.95] tracking-[-0.05em] sm:text-[2.8rem]">
                  <RotatingSubtitle
                    className="px-0"
                    texts={[
                      tRotating("link-shortener"),
                      tRotating("qr-code-generator"),
                      tRotating("marketing-platform"),
                      tRotating("analytics-dashboard"),
                      tRotating("personal-page"),
                    ]}
                  />
                </div>
                <p className="max-w-md text-sm leading-7 text-muted-foreground">
                  {t("hero-subtitle")}
                </p>
              </div>

              {heroFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="border-t border-black/5 pt-4 text-left lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0"
                >
                  <div className="mb-3 flex items-center gap-3 text-primary/75">
                    {feature.icon}
                    <span className="text-sm font-semibold text-foreground">
                      {feature.title}
                    </span>
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 border-t border-black/5 pt-6 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div key={stat.label} className="text-left sm:text-center">
                  <p className="font-[family-name:var(--font-editorial)] text-4xl font-semibold leading-none tracking-[-0.05em]">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-black/5 pt-6 text-sm text-muted-foreground">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {tHeader("pricing")}
              </p>
              {heroChecks.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary/75" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* <MarketingStatStrip
        items={[
          {
            value: t("stats.affordable-value"),
            label: t("stats.affordable-label"),
          },
          { value: t("stats.uptime-value"), label: t("stats.uptime-label") },
          { value: t("stats.links-value"), label: t("stats.links-label") },
          {
            value: t("stats.countries-value"),
            label: t("stats.countries-label"),
          },
        ]}
      /> */}

      <MarketingSection
        title={t("why-choose.title")}
        description={t("why-choose.subtitle")}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            {
              icon: <Shield className="h-5 w-5" />,
              title: t("why-choose.secure.title"),
              description: t("why-choose.secure.description"),
            },
            {
              icon: <Zap className="h-5 w-5" />,
              title: t("why-choose.fast.title"),
              description: t("why-choose.fast.description"),
            },
            {
              icon: <Globe className="h-5 w-5" />,
              title: t("why-choose.global.title"),
              description: t("why-choose.global.description"),
            },
            {
              icon: <Check className="h-5 w-5" />,
              title: t("why-choose.no-setup.title"),
              description: t("why-choose.no-setup.description"),
            },
          ].map((item) => (
            <div
              key={item.title}
              className="grid gap-4 border-t border-primary/10 pt-5 sm:grid-cols-[auto_minmax(0,1fr)]"
            >
              <div className="text-primary/75">{item.icon}</div>
              <div>
                <h3 className="font-[family-name:var(--font-editorial)] text-3xl leading-none tracking-[-0.04em]">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title={t("cta.title")}
        subtitle={t("cta.subtitle")}
        actions={
          <>
            <PrimaryActionLink href="/register">
              {t("cta.start-free")}
            </PrimaryActionLink>
            <SecondaryActionLink href="/pricing">
              {t("cta.view-pricing")}
            </SecondaryActionLink>
          </>
        }
      />
    </MarketingPage>
  );
}
