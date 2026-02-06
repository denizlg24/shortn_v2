import { redirect } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { polarClient } from "@/lib/polar";
import {
  getSubscriptionDetails,
  getCheckoutSessionDetails,
  getPendingScheduledChange,
} from "@/app/actions/polarActions";

export default async function SubscriptionSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    checkout_id?: string;
    sid?: string;
    sig?: string;
    action?: string;
    status?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("subscription-success");
  const { checkout_id, sid, sig, action, status } = await searchParams;

  if (checkout_id) {
    const result = await getCheckoutSessionDetails(checkout_id as string);

    if (!result.success || !result.checkout) {
      redirect({ href: "/dashboard", locale });
    }

    const checkout = result.checkout!;
    const product = checkout.product;
    const planName = product?.name || "Unknown Plan";
    const amount = checkout.amount || 0;
    const currency = checkout.currency || "USD";

    const formattedPrice = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);

    const formatDateTime = (date: Date | string | null) => {
      if (!date) return "N/A";
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return (
      <div className="flex w-full pt-12 justify-center px-4 pb-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {t("confirmed-title")}
              </h1>
              <p className="text-lg text-muted-foreground">
                {t("confirmed-subtitle", { plan: planName })}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("details-heading")}
              </h2>
              <div className="rounded-lg border bg-card">
                <div className="divide-y">
                  <div className="flex justify-between p-4">
                    <span className="text-sm text-muted-foreground">
                      {t("plan")}
                    </span>
                    <span className="text-sm font-semibold">{planName}</span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-sm text-muted-foreground">
                      {t("status")}
                    </span>
                    <span className="text-sm font-semibold capitalize text-green-600">
                      {t("active")}
                    </span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-sm text-muted-foreground">
                      {t("billing-amount")}
                    </span>
                    <span className="text-sm font-semibold">
                      {t("per-month", { price: formattedPrice })}
                    </span>
                  </div>
                  {checkout.createdAt && (
                    <div className="flex justify-between p-4">
                      <span className="text-sm text-muted-foreground">
                        {t("activated-on")}
                      </span>
                      <span className="text-sm font-medium">
                        {formatDateTime(checkout.createdAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {product?.description && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("what-you-get")}
                </h2>
                <div className="rounded-lg border bg-card p-4">
                  <div className="prose prose-sm text-muted-foreground max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {product.description}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="text-sm font-semibold text-green-900 mb-2">
              {t("next-title")}
            </h3>
            <p className="text-sm text-green-900">
              {t("next-description", { price: formattedPrice })}
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Button asChild size="lg">
              <Link href="/dashboard">
                {t("go-to-dashboard")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "payment_failed") {
    return (
      <div className="flex w-full pt-12 justify-center px-4">
        <div className="w-full max-w-lg space-y-8">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center">
              <XCircle className="h-16 w-16 text-red-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {t("payment-failed-title")}
              </h1>
              <p className="text-muted-foreground">
                {t("payment-failed-subtitle")}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-900">
              {t("payment-failed-description")}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/dashboard/subscription">{t("update-payment")}</Link>
            </Button>
            <Button variant="outline" asChild size="lg">
              <Link href="/dashboard">{t("return-to-dashboard")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!sid || !sig || !action) {
    redirect({ href: "/dashboard", locale });
  }

  const result = await getSubscriptionDetails(sid as string, sig as string);

  if (!result.success || !result.subscription) {
    redirect({ href: "/dashboard", locale });
  }

  const subscription = result.subscription!;
  const isUpgrade = action === "upgrade";

  let displayPlanName = subscription.product?.name || "Unknown Plan";
  let displayAmount = subscription.amount || 0;
  let displayCurrency = subscription.currency || "USD";
  let displayInterval = subscription.recurringInterval || "month";
  let displayDescription = subscription.product?.description || null;

  if (!isUpgrade) {
    const pendingChange = await getPendingScheduledChange();

    if (pendingChange && pendingChange.targetPlan) {
      try {
        const productsResponse = await polarClient.products.list({
          page: 1,
          limit: 100,
        });
        const products = productsResponse.result?.items || [];
        const targetProduct = products.find((p) =>
          p.name.toLowerCase().includes(pendingChange.targetPlan.toLowerCase()),
        );

        if (targetProduct) {
          displayPlanName = targetProduct.name;
          displayDescription = targetProduct.description;

          if (targetProduct.prices && targetProduct.prices.length > 0) {
            const price = targetProduct.prices[0];

            if ("priceAmount" in price && price.priceAmount !== undefined) {
              displayAmount = price.priceAmount;
            }
            if ("priceCurrency" in price && price.priceCurrency) {
              displayCurrency = price.priceCurrency;
            }
            if ("recurringInterval" in price && price.recurringInterval) {
              displayInterval = price.recurringInterval;
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch target product details:", error);
      }
    }
  }

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: displayCurrency,
  }).format(displayAmount / 100);

  const currentPeriodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="flex w-full pt-12 justify-center px-4 pb-12">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {isUpgrade ? t("updated-title") : t("downgrade-scheduled-title")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {isUpgrade
                ? t("updated-subtitle")
                : t("downgrade-scheduled-subtitle")}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("details-heading")}
            </h2>
            <div className="rounded-lg border bg-card">
              <div className="divide-y">
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    {isUpgrade ? t("plan") : t("new-plan")}
                  </span>
                  <span className="text-sm font-semibold">
                    {displayPlanName}
                  </span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    {t("status")}
                  </span>
                  <span className="text-sm font-semibold capitalize">
                    {isUpgrade
                      ? subscription.status || t("active")
                      : t("scheduled")}
                  </span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    {isUpgrade ? t("billing-amount") : t("new-billing-amount")}
                  </span>
                  <span className="text-sm font-semibold">
                    {t("per-interval", {
                      price: formattedPrice,
                      interval: displayInterval,
                    })}
                  </span>
                </div>
                {currentPeriodEnd && (
                  <div className="flex justify-between p-4">
                    <span className="text-sm text-muted-foreground">
                      {isUpgrade
                        ? t("next-billing-date")
                        : t("changes-effective")}
                    </span>
                    <span className="text-sm font-medium">
                      {formatDate(currentPeriodEnd)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {displayDescription && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {isUpgrade ? t("what-you-get") : t("whats-included")}
              </h2>
              <div className="rounded-lg border bg-card p-4">
                <div className="prose prose-sm text-muted-foreground max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {displayDescription}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>

        {isUpgrade && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              {t("upgrade-next-title")}
            </h3>
            <p className="text-sm text-blue-900">
              {t("upgrade-next-description")}
            </p>
          </div>
        )}

        {!isUpgrade && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-2">
              {t("downgrade-next-title")}
            </h3>
            <p className="text-sm text-amber-900">
              {t("downgrade-next-description", {
                date: currentPeriodEnd
                  ? formatDate(currentPeriodEnd)
                  : "the end of your billing period",
              })}
            </p>
          </div>
        )}

        <div className="flex justify-center pt-4">
          <Button asChild size="lg">
            <Link href="/dashboard">
              {t("go-to-dashboard")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
