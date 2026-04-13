import {
  getUserPlan,
  getPendingScheduledChange,
  getPolarPortalUrl,
} from "@/app/actions/polarActions";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { getServerSession } from "@/lib/session";
import { getRelativeOrder, SubscriptionsType } from "@/utils/plan-utils";
import { Check, X, AlertTriangle, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import React from "react";
import { CheckoutSessionButton } from "./checkout-session-button";
import { UpgradeSessionButton } from "./upgrade-plan-button";
import { CancelSubscriptionButton } from "./cancel-subscription-button";
import { RevertScheduledChangeButton } from "./revert-scheduled-change-button";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("subscription.title"),
    description: t("subscription.description"),
    keywords: t("subscription.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("subscription.title"),
      description: t("subscription.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("subscription.title"),
      description: t("subscription.description"),
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "/mo",
    highlights: ["3 shortn.at links / month", "3 QR Codes / month"],
    keep: "Manage usage",
    featured: false,
  },
  {
    id: "basic",
    name: "Basic",
    price: "$5",
    cadence: "/mo",
    highlights: [
      "25 shortn.at links / month",
      "25 QR Codes / month",
      "Click and scan count",
    ],
    keep: "Manage usage",
    featured: false,
  },
  {
    id: "plus",
    name: "Plus",
    price: "$15",
    cadence: "/mo",
    highlights: [
      "50 shortn.at links / month",
      "50 QR Codes / month",
      "Click and scan count",
      "Time and date based analytics",
      "City level location data",
    ],
    keep: "Manage usage",
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$25",
    cadence: "/mo",
    highlights: [
      "Unlimited shortn.at links and QR Codes",
      "Click and scan count",
      "Time and date based analytics",
      "City level location data",
      "Browser, Device and OS insights",
      "Referer information",
    ],
    keep: "Manage usage",
    featured: true,
  },
];

export const features = {
  "Shortn.at Links": {
    "Short Links": ["3", "25", "50", "Unlimited"],
    Redirects: ["-", "-", "10", "Unlimited"],
    "Custom Back-half": [0, 0, 0, 1],
    "Password Protection": [0, 0, 0, 1],
  },
  "Shortn Codes": {
    "QR Codes": ["3", "25", "50", "Unlimited"],
    Redirects: ["-", "-", "10", "Unlimited"],
    Frames: ["Full", "Full", "Full", "Full"],
    "Color options": ["Full", "Full", "Full", "Full"],
    "Custom Logo": [0, 0, 0, 1],
    "Download format": [
      "PNG, JPEG, SVG",
      "PNG, JPEG, SVG",
      "PNG, JPEG, SVG",
      "PNG, JPEG, SVG",
    ],
  },
  Analytics: {
    "Click Count": [0, 1, 1, 1],
    "Scan Count": [0, 1, 1, 1],
    "Time & date based analytics": [0, 0, 1, 1],
    "City level location data": [0, 0, 1, 1],
    "Device, OS & Browser Data": [0, 0, 0, 1],
    "Referer data": [0, 0, 0, 1],
    "Export to CSV file": [0, 0, 0, 1],
  },
  Campaigns: {
    "Group Links by Campaigns": [0, 0, 0, 1],
    "UTM Builder": [0, 0, 0, 1],
    "Campaign Tracking": [0, 0, 0, 1],
  },
  Pages: {
    "Custom Landing Page": [0, 0, 0, "Multiple"],
    "Multiple Links on Page": [0, 0, 0, 1],
    "Full Page Customization": [0, 0, 0, 1],
  },
};

export type Features = typeof features;
export type SectionKey = keyof Features;
export type TitleKey<S extends SectionKey> = keyof Features[S];

function PlanAction({
  plan,
  currentPlan,
  pendingChange,
  t,
}: {
  plan: (typeof plans)[number];
  currentPlan: string;
  pendingChange: Awaited<ReturnType<typeof getPendingScheduledChange>>;
  t: Awaited<ReturnType<typeof getTranslations<"subscription">>>;
}) {
  if (plan.id === currentPlan) {
    return (
      <Button variant="secondary" size="sm" asChild>
        <Link href="/dashboard/settings/plan">{t("manage-usage")}</Link>
      </Button>
    );
  }

  if (currentPlan === "free") {
    return (
      <CheckoutSessionButton
        slug={plan.id as "pro" | "plus" | "basic"}
        text={t("upgrade-to", { plan: plan.name })}
        variant={plan.featured ? "default" : "outline"}
      />
    );
  }

  if (plan.id === "free") {
    if (pendingChange?.changeType === "cancellation") {
      return (
        <RevertScheduledChangeButton pendingChange={pendingChange}>
          <Button variant="outline" size="sm">
            {t("keep-current-plan")}
          </Button>
        </RevertScheduledChangeButton>
      );
    }
    return (
      <CancelSubscriptionButton>
        <Button variant="outline" size="sm" className="text-destructive">
          {t("cancel-plan")}
        </Button>
      </CancelSubscriptionButton>
    );
  }

  if (pendingChange && pendingChange.targetPlan === plan.id) {
    return (
      <RevertScheduledChangeButton pendingChange={pendingChange}>
        <Button variant="outline" size="sm">
          {t("keep-current-plan")}
        </Button>
      </RevertScheduledChangeButton>
    );
  }

  if (pendingChange) {
    return (
      <Button variant="outline" size="sm" disabled className="capitalize">
        {t("pending-change")}
      </Button>
    );
  }

  const relativeOrder = getRelativeOrder(
    currentPlan as SubscriptionsType,
    plan.id as SubscriptionsType,
  );

  return (
    <UpgradeSessionButton
      slug={plan.id as "pro" | "plus" | "basic"}
      downgrade={relativeOrder < 0}
    >
      <Button
        variant={plan.featured ? "default" : "outline"}
        size="sm"
        className="capitalize"
      >
        {relativeOrder > 0
          ? t("upgrade-to", { plan: plan.name })
          : t("downgrade-to", { plan: plan.name })}
      </Button>
    </UpgradeSessionButton>
  );
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("subscription");
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    redirect({ href: "/dashboard/logout", locale: locale });
    return;
  }
  const { plan: _plan, status: subscriptionStatus } = await getUserPlan();
  const pendingChange = await getPendingScheduledChange();

  const isPastDue = subscriptionStatus === "past_due";

  let portalUrl: string | null = null;
  if (isPastDue) {
    const portalResult = await getPolarPortalUrl();
    if (portalResult.success) {
      portalUrl = portalResult.url ?? null;
    }
  }

  return (
    <div className="max-w-5xl mx-auto w-full sm:mt-8 mt-4 px-4 pb-16">
      {/* Header */}
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* Payment failure banner */}
      {isPastDue && (
        <div className="mt-6 flex items-start gap-3 border-l-2 border-destructive bg-destructive/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              {t("payment-past-due-title")}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("payment-past-due-description", {
                plan: _plan.charAt(0).toUpperCase() + _plan.slice(1),
              })}
            </p>
          </div>
          {portalUrl ? (
            <Button
              variant="destructive"
              size="sm"
              asChild
              className="shrink-0"
            >
              <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                {t("payment-past-due-cta")}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              asChild
              className="shrink-0"
            >
              <Link href="/dashboard/settings/plan">
                {t("payment-past-due-cta")}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Pending change notice */}
      {pendingChange && (
        <div className="mt-6 flex items-start gap-3 border-l-2 border-amber-500 bg-amber-50 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">
              {pendingChange.changeType === "cancellation"
                ? t("cancellation-scheduled")
                : t("downgrade-scheduled", {
                    plan: pendingChange.targetPlan,
                  })}
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              {t("change-effect", {
                type: pendingChange.changeType,
                date: new Date(pendingChange.scheduledFor).toLocaleDateString(
                  locale,
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                ),
              })}
            </p>
          </div>
          <RevertScheduledChangeButton pendingChange={pendingChange}>
            <Button variant="outline" size="sm">
              {t("revert")}
            </Button>
          </RevertScheduledChangeButton>
        </div>
      )}

      {/* Plans — editorial row layout */}
      <section className="mt-10">
        <div className="hidden sm:block">
          {/* Desktop: horizontal plan rows */}
          <div className="border-b border-border pb-3 mb-1 grid grid-cols-[1fr_auto] items-end">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Plan
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
              Price
            </span>
          </div>
          {plans.map((plan) => {
            const isCurrent = plan.id === _plan;
            return (
              <div
                key={plan.id}
                className={`grid grid-cols-[1fr_auto] items-center gap-4 py-4 border-b border-border/50 ${
                  isCurrent ? "bg-accent/30 -mx-4 px-4 border-border" : ""
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{plan.name}</h3>
                      {plan.featured && (
                        <span className="text-[10px] font-medium uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                          {t("recommended")}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          {t("your-plan")}
                        </span>
                      )}
                      {isCurrent && isPastDue && (
                        <span className="text-[10px] font-medium uppercase tracking-wider bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                          {t("payment-past-due-title")}
                        </span>
                      )}
                    </div>
                    <ul className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {plan.highlights.map((h) => (
                        <li
                          key={h}
                          className="text-xs text-muted-foreground flex items-center gap-1"
                        >
                          <Check className="h-3 w-3 shrink-0 text-primary/60" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right mr-2">
                    <span className="text-lg font-semibold tabular-nums">
                      {plan.price}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {plan.cadence}
                    </span>
                  </div>
                  <div className="w-40">
                    <PlanAction
                      plan={plan}
                      currentPlan={_plan}
                      pendingChange={pendingChange}
                      t={t}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground mt-3">
            {t("billed-monthly")}{" "}
            <a href="#compare" className="underline underline-offset-2">
              {t("compare-plans")}
            </a>
          </p>
        </div>

        {/* Mobile: stacked layout */}
        <div className="sm:hidden space-y-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === _plan;
            return (
              <div
                key={plan.id}
                className={`py-4 px-3 border-b border-border/50 ${
                  isCurrent
                    ? "bg-accent/30 -mx-3 px-3 border-border rounded-sm"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold">{plan.name}</h3>
                      {plan.featured && (
                        <span className="text-[10px] font-medium uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                          {t("recommended")}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          {t("your-plan")}
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <span className="text-lg font-semibold tabular-nums">
                        {plan.price}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {plan.cadence}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 pt-1">
                    <PlanAction
                      plan={plan}
                      currentPlan={_plan}
                      pendingChange={pendingChange}
                      t={t}
                    />
                  </div>
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                  {plan.highlights.map((h) => (
                    <li
                      key={h}
                      className="text-xs text-muted-foreground flex items-center gap-1"
                    >
                      <Check className="h-3 w-3 shrink-0 text-primary/60" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground mt-2">
            {t("billed-monthly")}{" "}
            <a href="#compare" className="underline underline-offset-2">
              {t("compare-plans")}
            </a>
          </p>
        </div>
      </section>

      {/* Comparison table — clean, no cell borders */}
      <section id="compare" className="mt-16 max-w-5xl">
        {/* Desktop comparison */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-5 gap-0">
            <div className="col-span-1" />
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="col-span-1 py-3 flex flex-col items-center gap-0.5"
              >
                <span className="text-sm font-semibold">{plan.name}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {plan.price}
                  </span>
                  {plan.cadence}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border" />

          {Object.keys(features).map((sectionKey) => {
            const section = sectionKey as SectionKey;
            const sectionData = features[section];
            return (
              <React.Fragment key={section}>
                <div className="py-2.5 mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section}
                  </h3>
                </div>
                {Object.keys(sectionData).map((titleKey, rowIdx) => {
                  const title = titleKey as TitleKey<typeof section>;
                  const values = sectionData[title] as string[] | number[];
                  return (
                    <div
                      key={title}
                      className={`grid grid-cols-5 gap-0 py-2.5 ${
                        rowIdx % 2 === 0 ? "bg-muted/30" : ""
                      }`}
                    >
                      <span className="col-span-1 text-sm pl-2">{title}</span>
                      {values.map((value, i) => (
                        <div
                          key={i}
                          className="col-span-1 flex items-center justify-center text-sm"
                        >
                          {typeof value === "number" ? (
                            value === 1 ? (
                              <Check className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-muted-foreground/40" />
                            )
                          ) : (
                            <span className="text-muted-foreground">
                              {value}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile comparison — accordion per plan */}
        <div className="sm:hidden space-y-3">
          {plans.map((plan) => (
            <details key={plan.id} className="group">
              <summary className="flex items-center justify-between py-3 cursor-pointer border-b border-border/50">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{plan.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {plan.price}
                    {plan.cadence}
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <div className="py-2">
                {Object.keys(features).map((sectionKey) => {
                  const section = sectionKey as SectionKey;
                  const sectionData = features[section];
                  const planIdx = plans.findIndex((p) => p.id === plan.id);
                  return (
                    <div key={section} className="mt-3 first:mt-0">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {section}
                      </h4>
                      {Object.keys(sectionData).map((titleKey) => {
                        const title = titleKey as TitleKey<typeof section>;
                        const values = sectionData[title] as
                          | string[]
                          | number[];
                        const value = values[planIdx];
                        return (
                          <div
                            key={title}
                            className="flex items-center justify-between py-1.5 text-sm"
                          >
                            <span className="text-muted-foreground">
                              {title}
                            </span>
                            <span>
                              {typeof value === "number" ? (
                                value === 1 ? (
                                  <Check className="w-3.5 h-3.5 text-primary" />
                                ) : (
                                  <X className="w-3.5 h-3.5 text-muted-foreground/40" />
                                )
                              ) : (
                                value
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
