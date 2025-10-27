"use client";
import { downgradeSubscription } from "@/app/actions/stripeActions";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { SubscriptionsType } from "@/utils/plan-utils";
import { useUser } from "@/utils/UserContext";
import {
  ArrowDown,
  Check,
  CornerLeftDown,
  CornerRightDown,
  Loader2,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    cadence: "/mo",
    highlights: ["3 shortn.at links / month", "3 QR Codes / month"],
    keep: "Stay with Free",
    featured: false,
  },
  {
    id: "basic",
    name: "Basic",
    price: "€5",
    cadence: "/mo",
    highlights: [
      "25 shortn.at links / month",
      "25 QR Codes / month",
      "Click and scan count",
    ],
    keep: "Manage plan",
    featured: false,
  },
  {
    id: "plus",
    name: "Plus",
    price: "€15",
    cadence: "/mo",
    highlights: [
      "50 shortn.at links / month",
      "50 QR Codes / month",
      "Click and scan count",
      "Time and date based analytics",
      "City level location data",
    ],
    keep: "Manage plan",
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "€25",
    cadence: "/mo",
    highlights: [
      "Unlimited shortn.at links and QR Codes",
      "Click and scan count",
      "Time and date based analytics",
      "City level location data",
      "Browser, Device and OS insights",
      "Referer information",
    ],
    keep: "Manage plan",
    featured: true,
  },
];

export const DowngradeForm = ({
  tier,
  currentPlan,
}: {
  tier: SubscriptionsType;
  currentPlan: SubscriptionsType;
}) => {
  const router = useRouter();
  const { refresh } = useUser();
  const [changing, setChanging] = useState(false);
  return (
    <div className="max-w-7xl mx-auto w-full sm:mt-8 mt-4 px-4">
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
            Are you sure?
          </h1>
          <p className="mt-3 max-w-2xl">
            We are sorry to see you go. If you decide to downgrade, you will
            lose access to all the features of the current plan.
          </p>
        </div>
      </header>

      <section className="lg:mt-12 sm:mt-6 mt-4 grid sm:grid-cols-2 gap-x-12 gap-y-6 w-full items-stretch">
        <h2 className="col-span-full text-xl font-bold leading-tight">
          Here&apos;s what you&apos;ll be loosing!
        </h2>
        <div className="flex flex-col gap-4 items-start w-full ">
          <p className="md:text-lg text-base font-semibold flex flex-row items-end gap-2 justify-start">
            Your current plan
            <CornerRightDown className="w-4 h-4 shrink-0" />
          </p>
          {plans
            .filter((p) => p.id == currentPlan)
            .map((plan) => {
              return (
                <article
                  key={plan.id}
                  className={`relative w-full h-full flex flex-col rounded-2xl p-4 border border-primary/10 shadow-xl ${
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
                  <ul className="mt-6 space-y-3 mb-4">
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
                  <Button
                    asChild
                    className="self-end place-self-end w-full mt-auto"
                  >
                    <Link href={"/dashboard/settings/plan"}>
                      Keep {plan.name}
                    </Link>
                  </Button>
                </article>
              );
            })}
        </div>

        <div className="flex flex-col gap-4 items-start w-full">
          <p className="md:text-lg text-base font-semibold sm:text-right text-left w-full flex flex-row items-end justify-end gap-2">
            <CornerLeftDown className="w-4 h-4 shrink-0" /> Downgrading to
          </p>
          {plans
            .filter((p) => p.id == tier)
            .map((plan) => {
              return (
                <article
                  key={plan.id}
                  className={`relative rounded-2xl w-full h-full flex flex-col p-4 border border-primary/10 shadow-xl ${
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
                  <ul className="mt-6 space-y-3 mb-4">
                    {plan.highlights.map((h) => {
                      const curr = plans.find((p) => p.id == currentPlan);
                      const included = curr?.highlights.includes(h);
                      if (included) {
                        return (
                          <li
                            key={h}
                            className="flex items-start gap-3 sm:text-sm text-xs"
                          >
                            <Check className="w-4 h-4 shrink-0 text-primary sm:mt-1.25" />
                            <span className="text-primary">{h}</span>
                          </li>
                        );
                      }
                      return (
                        <li
                          key={h}
                          className="flex items-start gap-3 sm:text-sm text-xs"
                        >
                          <ArrowDown className="w-4 h-4 shrink-0 text-red-700 sm:mt-1.25" />
                          <span className="text-red-700">{h}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <Button
                    onClick={async () => {
                      setChanging(true);
                      const result = await downgradeSubscription({
                        downgrade: tier,
                      });
                      if (result.success && result.token) {
                        await refresh();
                        router.push(
                          `/dashboard/subscription/downgraded?token=${result.token}`,
                        );
                      } else {
                        toast.error(
                          "There was a problem updating your plan. Try again later.",
                        );
                      }
                      setChanging(false);
                    }}
                    disabled={changing}
                    className="self-end place-self-end w-full mt-auto"
                    variant={"secondary"}
                  >
                    {changing ? (
                      <>
                        <Loader2 className="animate-spin" /> Updating...
                      </>
                    ) : plan.id != "free" ? (
                      `Change to ${plan.name}`
                    ) : (
                      "Cancel subscription"
                    )}
                  </Button>
                </article>
              );
            })}
        </div>
      </section>
    </div>
  );
};
