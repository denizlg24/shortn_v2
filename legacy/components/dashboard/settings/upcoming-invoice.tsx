"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarIcon, TrendingDown, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { getUpcomingInvoice } from "@/app/actions/polarActions";
import { Skeleton } from "@/components/ui/skeleton";
import { RevertScheduledChangeButton } from "@/app/[locale]/dashboard/subscription/revert-scheduled-change-button";
import { useTranslations } from "next-intl";

interface UpcomingInvoiceProps {
  className?: string;
}

interface InvoiceData {
  subscriptionId: string;
  currentPlan: string;
  currentPriceAmount: number;
  currency: string;
  nextBillingDate: Date | null;
  cancelAtPeriodEnd: boolean;
  status: string;
  hasScheduledChange: boolean;
  scheduledChange?: {
    _id: string;
    type: string;
    targetPlan: string;
    scheduledFor: string;
    willBeCanceled: boolean;
  };
}

export function UpcomingInvoice({ className }: UpcomingInvoiceProps) {
  const t = useTranslations("upcoming-invoice");
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getUpcomingInvoice();

      if (result.success && result.invoice) {
        setInvoice(result.invoice);
      } else {
        setError(result.error || "Failed to load invoice");
      }
    } catch (err) {
      console.error("Error fetching invoice:", err);
      setError("Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-6 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (error || !invoice) {
    return null; // Don't show the card if there's an error or no subscription
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount / 100);
  };

  const hasScheduledChange =
    invoice.hasScheduledChange && invoice.scheduledChange;
  const willBeCanceled =
    hasScheduledChange && invoice.scheduledChange?.willBeCanceled;
  const willBeDowngraded =
    hasScheduledChange && invoice.scheduledChange?.type === "downgrade";

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("title")}</h3>
          {invoice.status === "trialing" && (
            <Badge variant="secondary" className="text-xs">
              {t("trial-badge")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {invoice.nextBillingDate && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              <span>{t("billing-date")}</span>
            </div>
            <span className="text-sm font-medium">
              {format(new Date(invoice.nextBillingDate), "MMM dd, yyyy")}
            </span>
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("current-plan")}
            </span>
            <span className="text-sm font-medium">{invoice.currentPlan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("amount")}</span>
            <span className="text-lg font-semibold">
              {formatCurrency(invoice.currentPriceAmount, invoice.currency)}
            </span>
          </div>
        </div>

        {willBeCanceled && (
          <>
            <Separator />
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium text-destructive">
                    {t("subscription-ending")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("ending-description", {
                      date: format(
                        new Date(invoice.scheduledChange?.scheduledFor || ""),
                        "MMM dd, yyyy",
                      ),
                    })}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-destructive/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {t("next-invoice")}
                  </span>
                  <span className="text-lg font-semibold">
                    {formatCurrency(0, invoice.currency)}
                  </span>
                </div>
              </div>
              <div className="pt-2">
                <RevertScheduledChangeButton
                  pendingChange={{
                    _id: invoice.scheduledChange?._id || "",
                    changeType: "cancellation",
                    currentPlan: invoice.currentPlan,
                    targetPlan: invoice.currentPlan,
                    scheduledFor: invoice.scheduledChange?.scheduledFor || "",
                  }}
                  onRevertSuccess={fetchInvoice}
                >
                  <Button variant="outline" size="sm" className="w-full">
                    {t("keep-subscription")}
                  </Button>
                </RevertScheduledChangeButton>
              </div>
            </div>
          </>
        )}

        {willBeDowngraded && (
          <>
            <Separator />
            <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-500">
                    {t("scheduled-downgrade")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.rich("downgrade-description", {
                      plan: invoice.scheduledChange?.targetPlan || "no-plan",
                      date: format(
                        new Date(invoice.scheduledChange?.scheduledFor || ""),
                        "MMM dd, yyyy",
                      ),
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {t("downgrade-charge-note")}
              </p>
              <div className="pt-2">
                <RevertScheduledChangeButton
                  pendingChange={{
                    _id: invoice.scheduledChange?._id || "",
                    changeType: "downgrade",
                    currentPlan: invoice.currentPlan,
                    targetPlan: invoice.scheduledChange?.targetPlan || "free",
                    scheduledFor: invoice.scheduledChange?.scheduledFor || "",
                  }}
                  onRevertSuccess={fetchInvoice}
                >
                  <Button variant="outline" size="sm" className="w-full">
                    {t("keep-plan", { plan: invoice.currentPlan })}
                  </Button>
                </RevertScheduledChangeButton>
              </div>
            </div>
          </>
        )}

        {!hasScheduledChange && !invoice.cancelAtPeriodEnd && (
          <>
            <Separator />
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold">
                {t("next-invoice-total")}
              </span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(invoice.currentPriceAmount, invoice.currency)}
              </span>
            </div>
          </>
        )}

        <div className="pt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            {invoice.status === "trialing"
              ? t("trial-note")
              : t("auto-charge-note")}
          </p>
          <Separator />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t.rich("polar-note", {
              link: (chunks) => (
                <a
                  href="https://polar.sh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
