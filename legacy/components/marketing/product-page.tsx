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
