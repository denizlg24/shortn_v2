import {
  MarketingHero,
  MarketingPage,
  MarketingSection,
  PrimaryActionLink,
  SecondaryActionLink,
} from "@/components/marketing/marketing-primitives";
import {
  features,
  plans,
  SectionKey,
  TitleKey,
} from "../../dashboard/subscription/page";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Check, X } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import React from "react";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("pricing.title"),
    description: t("pricing.description"),
    keywords: t("pricing.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("pricing.title"),
      description: t("pricing.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("pricing.title"),
      description: t("pricing.description"),
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
  const t = await getTranslations("pricing");

  return (
    <MarketingPage>
      <MarketingHero
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <PrimaryActionLink href="/register">
              {t("get-started")}
            </PrimaryActionLink>
            <SecondaryActionLink href="#compare">
              {t("monthly-billing")}
            </SecondaryActionLink>
          </>
        }
      />

      <MarketingSection>
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex h-full flex-col gap-6 border-t pt-5 ${
                plan.featured
                  ? "border-primary bg-primary/[0.04] px-5 pb-5"
                  : "border-primary/15 pb-5"
              }`}
            >
              {plan.featured ? (
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-primary">
                  {t("recommended")}
                </p>
              ) : null}
              <div>
                <h2 className="font-[family-name:var(--font-editorial)] text-4xl leading-none tracking-[-0.05em]">
                  {plan.name}
                </h2>
                <div className="mt-4 flex items-end gap-2">
                  <span className="font-[family-name:var(--font-editorial)] text-5xl leading-none tracking-[-0.05em]">
                    {plan.price}
                  </span>
                  <span className="pb-1 text-sm text-muted-foreground">
                    {plan.cadence}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {t("monthly-billing")} · {t("cancel-anytime")}
                </p>
              </div>
              <ul className="space-y-3">
                {plan.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-3 text-sm"
                  >
                    <Check className="mt-0.5 h-4 w-4 text-primary/75" />
                    <span className="text-muted-foreground">{highlight}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                variant={plan.featured ? "default" : "outline"}
                className="mt-auto rounded-full"
              >
                <Link href="/register">{t("get-started")}</Link>
              </Button>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div
          id="compare"
          className="hidden overflow-hidden border-t border-primary/15 lg:block"
        >
          <div className="grid grid-cols-[minmax(14rem,1.2fr)_repeat(4,minmax(8rem,1fr))]">
            <div />
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`border-l border-primary/10 px-4 py-5 text-center ${
                  plan.featured ? "bg-primary/[0.04]" : ""
                }`}
              >
                <p className="font-[family-name:var(--font-editorial)] text-3xl leading-none tracking-[-0.04em]">
                  {plan.name}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.price}
                  {plan.cadence}
                </p>
              </div>
            ))}

            {Object.keys(features).map((sectionKey) => {
              const section = sectionKey as SectionKey;
              const sectionData = features[section];

              return (
                <React.Fragment key={section}>
                  <div className="col-span-full border-t border-primary/15 py-5">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {section}
                    </p>
                  </div>
                  {Object.keys(sectionData).map((titleKey) => {
                    const title = titleKey as TitleKey<typeof section>;
                    const values = sectionData[title] as Array<string | number>;

                    return (
                      <React.Fragment key={title}>
                        <div className="border-t border-primary/10 py-4 pr-4 text-sm text-muted-foreground">
                          {title}
                        </div>
                        {values.map((value, index) => (
                          <div
                            key={`${title}-${index}`}
                            className={`flex items-center justify-center border-l border-t border-primary/10 px-4 py-4 text-sm ${
                              plans[index]?.featured ? "bg-primary/[0.04]" : ""
                            }`}
                          >
                            {typeof value === "number" ? (
                              value === 1 ? (
                                <Check className="h-4 w-4 text-primary/75" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground/60" />
                              )
                            ) : (
                              <span className="text-muted-foreground">
                                {value}
                              </span>
                            )}
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="space-y-10 lg:hidden">
          {plans.map((plan) => {
            const planIndex = plans.findIndex(({ id }) => id === plan.id);

            return (
              <article
                key={plan.id}
                className="border-t border-primary/15 pt-5"
              >
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <h3 className="font-[family-name:var(--font-editorial)] text-4xl leading-none tracking-[-0.05em]">
                      {plan.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.price}
                      {plan.cadence}
                    </p>
                  </div>
                  {plan.featured ? (
                    <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-primary">
                      {t("recommended")}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-5">
                  {Object.keys(features).map((sectionKey) => {
                    const section = sectionKey as SectionKey;
                    const sectionData = features[section];

                    return (
                      <div key={section} className="space-y-3">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                          {section}
                        </p>
                        <div className="space-y-2">
                          {Object.keys(sectionData).map((titleKey) => {
                            const title = titleKey as TitleKey<typeof section>;
                            const values = sectionData[title] as Array<
                              string | number
                            >;
                            const value = values[planIndex];

                            return (
                              <div
                                key={`${plan.id}-${title}`}
                                className="flex items-center justify-between gap-4 border-t border-primary/10 py-3 text-sm"
                              >
                                <span className="text-muted-foreground">
                                  {title}
                                </span>
                                <span className="font-medium text-foreground">
                                  {typeof value === "number" ? (
                                    value === 1 ? (
                                      <Check className="h-4 w-4 text-primary/75" />
                                    ) : (
                                      <X className="h-4 w-4 text-muted-foreground/60" />
                                    )
                                  ) : (
                                    value
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
