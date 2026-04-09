import {
  MarketingCtaBand,
  MarketingFeatureGrid,
  MarketingHero,
  MarketingPage,
  MarketingQuoteStrip,
  MarketingSection,
  PrimaryActionLink,
} from "@/components/marketing/marketing-primitives";
import * as React from "react";

interface ProductFeature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function ProductPage({
  title,
  subtitle,
  ctaLabel,
  featuresTitle,
  features,
  quotesTitle,
  quotes,
  finalTitle,
  finalSubtitle,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  featuresTitle: string;
  features: ProductFeature[];
  quotesTitle: string;
  quotes: string[];
  finalTitle: string;
  finalSubtitle: string;
}) {
  return (
    <MarketingPage>
      <MarketingHero
        title={title}
        subtitle={subtitle}
        actions={
          <PrimaryActionLink href="/register">{ctaLabel}</PrimaryActionLink>
        }
        aside={
          <div className="space-y-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {featuresTitle}
            </p>
            <div className="space-y-5">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="border-t border-primary/10 pt-4 first:border-t-0 first:pt-0"
                >
                  <div className="mb-2 flex items-center gap-3 text-primary/75">
                    {feature.icon}
                  </div>
                  <p className="font-medium">{feature.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <MarketingSection title={featuresTitle}>
        <MarketingFeatureGrid items={features} />
      </MarketingSection>

      <MarketingSection title={quotesTitle}>
        <MarketingQuoteStrip quotes={quotes} />
      </MarketingSection>

      <MarketingCtaBand
        title={finalTitle}
        subtitle={finalSubtitle}
        actions={
          <PrimaryActionLink href="/register">{ctaLabel}</PrimaryActionLink>
        }
      />
    </MarketingPage>
  );
}
