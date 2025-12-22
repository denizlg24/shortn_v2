"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useRouter } from "@/i18n/navigation";
import { SubscriptionsType } from "@/utils/plan-utils";
import {
  ArrowDown,
  Check,
  CornerLeftDown,
  CornerRightDown,
  Loader2,
  AlertCircle,
  TrendingDown,
} from "lucide-react";
import React, { useState } from "react";

const plans = [
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
    keep: "Manage plan",
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
    keep: "Manage plan",
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
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDowngrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/polar/create-update-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug: tier, downgrade: true }),
      });
      const data = await response.json();

      if (data.success) {
        setOpen(false);

        router.push(
          `/dashboard/subscription/success?sid=${data.subscription.id}&sig=${data.signature}&action=downgrade`,
        );
      } else if (data.paymentFailed) {
        setOpen(false);
        router.push(`/dashboard/subscription/success?status=payment_failed`);
      } else {
        setError(
          data.message || "Failed to update subscription. Please try again.",
        );
      }
    } catch (error) {
      console.error("Failed to downgrade subscription:", error);
      setError(
        "An unexpected error occurred. Please try again or contact support.",
      );
    }
    setLoading(false);
  };

  const targetPlan = plans.find((p) => p.id === tier);

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
                      ? "bg-linear-to-br from-[#e6f0ff] to-[#dfeaff] border-primary/30"
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
                      ? "bg-linear-to-br from-[#e6f0ff] to-[#dfeaff] border-primary/30"
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
                    onClick={() => setOpen(true)}
                    className="self-end place-self-end w-full mt-auto"
                    variant={"secondary"}
                  >
                    Change to {plan.name}
                  </Button>
                </article>
              );
            })}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <TrendingDown className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">
              Confirm Downgrade
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              You're about to downgrade to the{" "}
              <span className="font-semibold text-foreground">
                {targetPlan?.name}
              </span>{" "}
              plan. Your subscription will be prorated and the downgrade will
              take effect at the end of your current billing period. You'll
              receive a credit for the unused time.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Button
              onClick={handleDowngrade}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Downgrade"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              Cancel
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Your downgrade will be scheduled for the end of your current billing
            period.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};
