"use client";

import { usePlan } from "@/hooks/use-plan";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function SubscriptionStatusBanner() {
  const { status, plan } = usePlan();
  const [dismissed, setDismissed] = useState(false);
  const t = useTranslations("subscription");

  if (status !== "past_due" || dismissed) {
    return null;
  }

  return (
    <div className="w-full bg-destructive/5 border-b border-destructive/20 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <p className="text-sm text-foreground flex-1 min-w-0">
          <span className="font-medium">{t("payment-past-due-title")}:</span>{" "}
          <span className="text-muted-foreground">
            {t("payment-past-due-description", {
              plan: plan.charAt(0).toUpperCase() + plan.slice(1),
            })}
          </span>
        </p>
        <Button
          variant="destructive"
          size="sm"
          asChild
          className="shrink-0 h-7 text-xs"
        >
          <Link href="/dashboard/subscription">
            {t("payment-past-due-cta")}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
