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
  Loader2,
  AlertCircle,
  TrendingDown,
} from "lucide-react";
import React, { useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("downgrade-form");
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
        setError(data.message || t("error-default"));
      }
    } catch (error) {
      console.error("Failed to downgrade subscription:", error);
      setError(t("error-unexpected"));
    }
    setLoading(false);
  };

  const currentPlanData = plans.find((p) => p.id === currentPlan);
  const targetPlan = plans.find((p) => p.id === tier);

  return (
    <div className="max-w-2xl mx-auto w-full sm:mt-8 mt-4 px-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground max-w-lg">{t("subtitle")}</p>
      </header>

      <section className="mt-8 space-y-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("losing-title")}
        </h2>

        {/* Side-by-side plan comparison */}
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Current plan */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              {t("current-plan")}
            </p>
            {currentPlanData && (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">
                    {currentPlanData.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {currentPlanData.price}
                    {currentPlanData.cadence}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {currentPlanData.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                      {h}
                    </li>
                  ))}
                </ul>
                <Button asChild size="sm">
                  <Link href="/dashboard/settings/plan">
                    {t("keep-plan", { plan: currentPlanData.name })}
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Target plan */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              {t("downgrading-to")}
            </p>
            {targetPlan && (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">
                    {targetPlan.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {targetPlan.price}
                    {targetPlan.cadence}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {targetPlan.highlights.map((h) => {
                    const included = currentPlanData?.highlights.includes(h);
                    return (
                      <li
                        key={h}
                        className={`flex items-center gap-2 text-sm ${
                          included
                            ? "text-muted-foreground"
                            : "text-destructive"
                        }`}
                      >
                        {included ? (
                          <Check className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {h}
                      </li>
                    );
                  })}
                </ul>
                <Button
                  onClick={() => setOpen(true)}
                  variant="outline"
                  size="sm"
                >
                  {t("change-to", { plan: targetPlan.name })}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <TrendingDown className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">
              {t("confirm-title")}
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              {t.rich("confirm-description", {
                plan: targetPlan?.name || "no-plan",
                strong: (chunks) => (
                  <span className="font-semibold text-foreground">
                    {chunks}
                  </span>
                ),
              })}
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
                  {t("processing")}
                </>
              ) : (
                t("confirm")
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {t("cancel")}
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("note")}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};
