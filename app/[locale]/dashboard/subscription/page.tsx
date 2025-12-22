import {
  getUserPlan,
  getPendingScheduledChange,
} from "@/app/actions/polarActions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getServerSession } from "@/lib/session";
import { getRelativeOrder, SubscriptionsType } from "@/utils/plan-utils";
import { Check, X } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { forbidden } from "next/navigation";
import React from "react";
import { CheckoutSessionButton } from "./checkout-session-button";
import { UpgradeSessionButton } from "./upgrade-plan-button";
import { CancelSubscriptionButton } from "./cancel-subscription-button";
import { RevertScheduledChangeButton } from "./revert-scheduled-change-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    forbidden();
  }
  const { plan: _plan } = await getUserPlan();
  const pendingChange = await getPendingScheduledChange();

  return (
    <div className="max-w-7xl mx-auto w-full sm:mt-8 mt-4 px-4">
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
            Plans & Pricing
          </h1>
          <p className="mt-3 max-w-xl">
            Choose a plan that fits your needs. Upgrade at any time to unlock
            Full analytics.
          </p>
        </div>
      </header>

      {pendingChange && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">
                {pendingChange.changeType === "cancellation"
                  ? "Subscription Cancellation Scheduled"
                  : `Downgrade to ${pendingChange.targetPlan} Scheduled`}
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                Your {pendingChange.changeType} will take effect on{" "}
                {new Date(pendingChange.scheduledFor).toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
                . You can revert this change at any time before then.
              </p>
            </div>
            <RevertScheduledChangeButton pendingChange={pendingChange}>
              <Button variant="outline" size="sm">
                Revert
              </Button>
            </RevertScheduledChangeButton>
          </div>
        </div>
      )}

      <section className="lg:mt-12 sm:mt-6 mt-4 grid xl:grid-cols-4 lg:grid-cols-2 gap-6">
        {plans.map((plan) => {
          return (
            <article
              key={plan.id}
              className={`relative rounded-2xl p-4 border border-primary/10 shadow-xl ${
                plan.featured
                  ? "bg-gradient-to-br from-[#e6f0ff] to-[#dfeaff] border-primary/30"
                  : "bg-white"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-4 right-4 bg-primary text-white rounded-full px-3 py-1 text-sm font-semibold shadow-sm">
                  Recommended
                </div>
              )}

              <div className="flex items-baseline justify-between">
                <div>
                  <h4 className="text-2xl font-bold text-primary">
                    {plan.name}
                  </h4>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-3xl font-extrabold text-primary">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">
                      {plan.cadence}
                    </span>
                  </div>
                </div>
                <div className="text-right text-muted-foreground text-sm">
                  <div>Monthly billing</div>
                  <div className="mt-2">Cancel anytime</div>
                </div>
              </div>
              <div className="mt-6 flex flex-col items-start gap-1">
                {plan.id === _plan ? (
                  <Button className="w-full" variant="secondary" asChild>
                    <Link href="/dashboard/settings/plan">{plan.keep}</Link>
                  </Button>
                ) : _plan === "free" ? (
                  <CheckoutSessionButton
                    className="w-full"
                    text={`Upgrade to ${plan.name}`}
                    slug={plan.id as "pro" | "plus" | "basic"}
                    variant={plan.featured ? "default" : "outline"}
                  />
                ) : plan.id === "free" ? (
                  pendingChange?.changeType === "cancellation" ? (
                    <RevertScheduledChangeButton pendingChange={pendingChange}>
                      <Button className="w-full" variant="outline">
                        Keep Current Plan
                      </Button>
                    </RevertScheduledChangeButton>
                  ) : (
                    <CancelSubscriptionButton>
                      <Button className="w-full" variant="destructive">
                        Cancel Plan
                      </Button>
                    </CancelSubscriptionButton>
                  )
                ) : pendingChange && pendingChange.targetPlan === plan.id ? (
                  <RevertScheduledChangeButton pendingChange={pendingChange}>
                    <Button className="w-full" variant="outline">
                      Keep Current Plan
                    </Button>
                  </RevertScheduledChangeButton>
                ) : pendingChange ? (
                  <Button
                    className="capitalize w-full"
                    variant="outline"
                    disabled
                  >
                    Pending Change
                  </Button>
                ) : (
                  <UpgradeSessionButton
                    slug={plan.id as "pro" | "plus" | "basic"}
                    downgrade={
                      getRelativeOrder(
                        _plan as SubscriptionsType,
                        plan.id as SubscriptionsType,
                      ) < 0
                    }
                  >
                    <Button
                      className="capitalize w-full"
                      variant={plan.featured ? "default" : "outline"}
                    >
                      {getRelativeOrder(
                        _plan as SubscriptionsType,
                        plan.id as SubscriptionsType,
                      ) > 0
                        ? `Upgrade to ${plan.name}`
                        : `Downgrade to ${plan.name}`}
                    </Button>
                  </UpgradeSessionButton>
                )}
                <Button
                  variant={"link"}
                  asChild
                  className="text-sm p-0! h-fit!"
                >
                  <a href="#compare">Compare plans →</a>
                </Button>

                <div className="text-xs text-[#3b4d6b]">
                  Billed monthly. Taxes may apply.
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.highlights.map((h) => (
                  <li
                    key={h}
                    className="flex items-start gap-3 sm:text-sm text-xs"
                  >
                    <Check className="w-4 h-4 shrink-0 text-primary sm:mt-1.25" />
                    <span className="text-primary">{h}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <div className="w-full max-w-7xl px-2 mx-auto mt-16 mb-12">
        <div className="hidden sm:grid grid-cols-5 gap-0">
          <div className="col-span-1 top-0 h-full"></div>
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="col-span-1 border shadow p-2 flex flex-col items-center sm:gap-2 gap-0.5 sm:top-14 top-12 bg-background"
            >
              <h1 className="font-semibold text-base text-primary">
                {plan.name}
              </h1>
              <h2 className="text-sm text-muted-foreground text-center min-[375px]:block flex flex-col">
                <span className="text-lg font-bold text-primary">
                  {plan.price}
                </span>
                {plan.cadence}
              </h2>
            </div>
          ))}
          {Object.keys(features).map((sectionKey, i) => {
            const section = sectionKey as SectionKey;
            const sectionData = features[section];
            return (
              <React.Fragment key={section}>
                <div
                  id={i == 0 ? "compare" : ""}
                  className="col-span-full bg-muted p-3 border"
                >
                  <h3 className="text-base font-bold text-primary text-left">
                    {section}
                  </h3>
                </div>
                {Object.keys(sectionData).map((titleKey) => {
                  const title = titleKey as TitleKey<typeof section>;
                  const values = sectionData[title] as string[] | number[];
                  return (
                    <React.Fragment key={title}>
                      <h2 className="bg-background p-3 text-left text-sm font-semibold col-span-1 border">
                        {title}
                      </h2>
                      {values.map((value, i) => {
                        if (typeof value === "number") {
                          return (
                            <div
                              key={i}
                              className="col-span-1 bg-background w-full p-3 text-center flex items-center justify-center border"
                            >
                              {value === 1 ? (
                                <Check className="w-3.5 h-3.5 shrink-0 text-primary" />
                              ) : (
                                <X className="w-3.5 h-3.5 shrink-0 text-primary" />
                              )}
                            </div>
                          );
                        }
                        if (typeof value === "string") {
                          return (
                            <div
                              key={i}
                              className="col-span-1 w-full bg-background p-3 text-center flex items-center justify-center text-sm border"
                            >
                              {value}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        <div className="sm:hidden flex flex-col gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="border rounded-lg shadow bg-background"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <h2 className="font-semibold text-lg text-primary">
                    {plan.name}
                  </h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-primary">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">
                      {plan.cadence}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t">
                <Accordion type="single" collapsible>
                  {Object.keys(features).map((sectionKey) => {
                    const section = sectionKey as SectionKey;
                    const sectionData = features[section];
                    return (
                      <AccordionItem
                        className="px-4"
                        key={section}
                        value={section}
                      >
                        <AccordionTrigger>{section}</AccordionTrigger>
                        <AccordionContent>
                          <ul className="flex flex-col gap-2">
                            {Object.keys(sectionData).map((titleKey) => {
                              const title = titleKey as TitleKey<
                                typeof section
                              >;
                              const values = sectionData[title] as
                                | string[]
                                | number[];
                              const planIdx = plans.findIndex(
                                (p) => p.id === plan.id,
                              );
                              const value = values[planIdx];
                              return (
                                <li
                                  key={title}
                                  className="flex items-center justify-between text-sm py-1 border-b last:border-b-0"
                                >
                                  <span>{title}</span>
                                  <span>
                                    {typeof value === "number" ? (
                                      value === 1 ? (
                                        <Check className="w-4 h-4 text-primary inline" />
                                      ) : (
                                        <X className="w-4 h-4 text-primary inline" />
                                      )
                                    ) : (
                                      value
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
