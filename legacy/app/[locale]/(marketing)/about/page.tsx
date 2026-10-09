import {
  MarketingCtaBand,
  MarketingHero,
  MarketingPage,
  MarketingSection,
  PrimaryActionLink,
} from "@/components/marketing/marketing-primitives";
import { Globe, Target } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
// import claudeLogo from "@/public/claude-logo.svg";
import headshot from "@/public/headshot-square.png";
import polarLogo from "@/public/polar-sh.webp";
import shadcnLogo from "@/public/shadcn-ui.png";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("about.title"),
    description: t("about.description"),
    keywords: t("about.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("about.title"),
      description: t("about.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("about.title"),
      description: t("about.description"),
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
  const t = await getTranslations("about");

  return (
    <MarketingPage>
      <MarketingHero
        title={t("brand-management-affordable-for-everyone")}
        subtitle={t(
          "we-believe-powerful-tools-shouldnt-come-with-enterprise-price-tags-thats-why-we-built-shortn-at",
        )}
        actions={
          <PrimaryActionLink href="/register">
            {t("get-started-today")}
          </PrimaryActionLink>
        }
        aside={
          <div className="space-y-5">
            {[
              {
                title: t("fast-and-reliable"),
                description: t(
                  "global-cdn-ensures-lightning-fast-redirects-worldwide",
                ),
              },
              {
                title: t("customer-first"),
                description: t("built-with-feedback-from-hundreds-of-users"),
              },
              {
                title: t("quality-focused"),
                description: t(
                  "99-9-uptime-sla-with-enterprise-grade-infrastructure",
                ),
              },
            ].map((item) => (
              <div key={item.title} className="border-t border-primary/10 pt-4">
                <div className="mb-2 text-primary/75">
                  <Globe className="h-4 w-4" />
                </div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        }
      />

      <MarketingSection
        title={t("democratizing-professional-link-management")}
        description={t(
          "we-knew-there-was-a-better-way-by-building-efficient-infrastructure-and-focusing-on-what-matters-we-created-a-platform-that-offers-enterprise-features-at-85-lower-prices-without-compromising-on-quality-or-reliability",
        )}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.85fr)]">
          <div className="space-y-6 text-sm leading-8 text-muted-foreground sm:text-base">
            <p>
              {t(
                "we-started-shortn-at-because-we-were-frustrated-with-the-high-costs-of-existing-link-management-platforms-small-businesses-creators-and-startups-were-paying-hundreds-of-dollars-per-month-for-basic-features",
              )}
            </p>
            <p>
              {t(
                "we-knew-there-was-a-better-way-by-building-efficient-infrastructure-and-focusing-on-what-matters-we-created-a-platform-that-offers-enterprise-features-at-85-lower-prices-without-compromising-on-quality-or-reliability",
              )}
            </p>
          </div>
          <div className="border-t border-primary/10 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="space-y-5">
              <div className="border-t border-primary/10 pt-4 first:border-t-0 first:pt-0">
                <Target className="h-5 w-5 text-primary/75" />
                <p className="mt-3 font-medium">{t("fast-and-reliable")}</p>
              </div>
              <div className="border-t border-primary/10 pt-4">
                <p className="font-medium">{t("customer-first")}</p>
              </div>
              <div className="border-t border-primary/10 pt-4">
                <p className="font-medium">{t("quality-focused")}</p>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>

      <div className="mt-8 grid gap-6 border-y border-black/5 py-6 sm:grid-cols-3">
        {[
          { value: "2023", label: t("founded") },
          { value: "15K+", label: t("links-served") },
          { value: "35+", label: t("countries-reached") },
        ].map((stat) => (
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

      <MarketingSection
        title={t("built-by-a-passionate-team")}
        description={t(
          "were-passionate-about-creating-tools-that-empower-individuals-and-businesses-to-succeed-online-your-support-means-the-world-to-us",
        )}
      >
        <div className="grid gap-8 lg:grid-cols-3">
          <article className="border-t border-primary/15 pt-5">
            <Image
              src={headshot}
              alt="Deniz"
              className="mb-5 aspect-square w-28 rounded-full object-cover"
            />
            <h3 className="font-[family-name:var(--font-editorial)] text-3xl leading-none tracking-[-0.04em]">
              Deniz
            </h3>
            <p className="mt-2 text-sm font-medium text-primary">
              {t("founder-and-developer")}
            </p>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {t(
                "building-the-future-of-link-management-one-feature-at-a-time",
              )}
            </p>
          </article>

          {/* <article className="border-t border-primary/15 pt-5">
            <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="h-12 w-12 fill-current">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-editorial)] text-3xl leading-none tracking-[-0.04em]">
              GitHub Copilot
            </h3>
            <p className="mt-2 text-sm font-medium text-primary">
              {t("ai-pair-programmer")}
            </p>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {t(
                "accelerating-development-with-intelligent-code-suggestions-and-completions",
              )}
            </p>
          </article>

          <article className="border-t border-primary/15 pt-5">
            <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-full border border-primary/10 bg-background">
              <Image src={claudeLogo} alt="Claude" className="h-12 w-12" />
            </div>
            <h3 className="font-[family-name:var(--font-editorial)] text-3xl leading-none tracking-[-0.04em]">
              Claude
            </h3>
            <p className="mt-2 text-sm font-medium text-primary">
              {t("ai-assistant")}
            </p>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {t(
                "helping-architect-solutions-and-solve-complex-problems-with-thoughtful-analysis",
              )}
            </p>
          </article> */}
        </div>
      </MarketingSection>

      <MarketingSection title={t("built-with")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: "Next.js" },
            { label: "Vercel" },
            { label: "MongoDB" },
            { label: "Polar.sh", image: polarLogo },
            { label: "Better Auth" },
            { label: "shadcn/ui", image: shadcnLogo },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 border-t border-primary/10 py-4"
            >
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.label}
                  className="h-5 w-5 object-contain opacity-70"
                />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-primary/50" />
              )}
              <span className="text-sm text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title={t("get-started-today")}
        subtitle={t(
          "were-passionate-about-creating-tools-that-empower-individuals-and-businesses-to-succeed-online-your-support-means-the-world-to-us",
        )}
        actions={
          <PrimaryActionLink href="/register">
            {t("get-started-today")}
          </PrimaryActionLink>
        }
      />
    </MarketingPage>
  );
}
