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
        <div className="w-full max-w-lg space-y-8">
          <div className="space-y-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("confirmed-title")}
            </h1>
            <p className="text-muted-foreground">
              {t("confirmed-subtitle", { plan: planName })}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("details-heading")}
            </h2>
            <dl className="space-y-0 divide-y divide-border/50">
              <div className="flex justify-between py-3">
                <dt className="text-sm text-muted-foreground">{t("plan")}</dt>
                <dd className="text-sm font-medium">{planName}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-sm text-muted-foreground">{t("status")}</dt>
                <dd className="text-sm font-medium text-green-600">
                  {t("active")}
                </dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-sm text-muted-foreground">
                  {t("billing-amount")}
                </dt>
                <dd className="text-sm font-medium">
                  {t("per-month", { price: formattedPrice })}
                </dd>
              </div>
              {checkout.createdAt && (
                <div className="flex justify-between py-3">
                  <dt className="text-sm text-muted-foreground">
                    {t("activated-on")}
                  </dt>
                  <dd className="text-sm font-medium">
                    {formatDateTime(checkout.createdAt)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {product?.description && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("what-you-get")}
              </h2>
              <div className="prose prose-sm text-muted-foreground max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {product.description}
                </ReactMarkdown>
              </div>
            </div>
          )}

          <div className="border-l-2 border-green-500 bg-green-50 pl-4 py-3">
            <p className="text-sm font-medium text-green-900">
              {t("next-title")}
            </p>
            <p className="text-sm text-green-800 mt-1">
              {t("next-description", { price: formattedPrice })}
            </p>
          </div>

          <Button asChild>
            <Link href="/dashboard">
              {t("go-to-dashboard")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "payment_failed") {
    return (
      <div className="flex w-full pt-12 justify-center px-4 pb-12">
        <div className="w-full max-w-lg space-y-8">
          <div className="space-y-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("payment-failed-title")}
            </h1>
            <p className="text-muted-foreground">
              {t("payment-failed-subtitle")}
            </p>
          </div>

          <div className="border-l-2 border-destructive bg-destructive/5 pl-4 py-3">
            <p className="text-sm text-foreground">
              {t("payment-failed-description")}
            </p>
          </div>

          <div className="flex gap-3">
            <Button asChild>
              <Link href="/dashboard/subscription">{t("update-payment")}</Link>
            </Button>
            <Button variant="outline" asChild>
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
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-3">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {isUpgrade ? t("updated-title") : t("downgrade-scheduled-title")}
          </h1>
          <p className="text-muted-foreground">
            {isUpgrade
              ? t("updated-subtitle")
              : t("downgrade-scheduled-subtitle")}
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("details-heading")}
          </h2>
          <dl className="space-y-0 divide-y divide-border/50">
            <div className="flex justify-between py-3">
              <dt className="text-sm text-muted-foreground">
                {isUpgrade ? t("plan") : t("new-plan")}
              </dt>
              <dd className="text-sm font-medium">{displayPlanName}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-sm text-muted-foreground">{t("status")}</dt>
              <dd className="text-sm font-medium capitalize">
                {isUpgrade
                  ? subscription.status || t("active")
                  : t("scheduled")}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-sm text-muted-foreground">
                {isUpgrade ? t("billing-amount") : t("new-billing-amount")}
              </dt>
              <dd className="text-sm font-medium">
                {t("per-interval", {
                  price: formattedPrice,
                  interval: displayInterval,
                })}
              </dd>
            </div>
            {currentPeriodEnd && (
              <div className="flex justify-between py-3">
                <dt className="text-sm text-muted-foreground">
                  {isUpgrade ? t("next-billing-date") : t("changes-effective")}
                </dt>
                <dd className="text-sm font-medium">
                  {formatDate(currentPeriodEnd)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {displayDescription && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isUpgrade ? t("what-you-get") : t("whats-included")}
            </h2>
            <div className="prose prose-sm text-muted-foreground max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {displayDescription}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {isUpgrade && (
          <div className="border-l-2 border-blue-500 bg-blue-50 pl-4 py-3">
            <p className="text-sm font-medium text-blue-900">
              {t("upgrade-next-title")}
            </p>
            <p className="text-sm text-blue-800 mt-1">
              {t("upgrade-next-description")}
            </p>
          </div>
        )}

        {!isUpgrade && (
          <div className="border-l-2 border-amber-500 bg-amber-50 pl-4 py-3">
            <p className="text-sm font-medium text-amber-900">
              {t("downgrade-next-title")}
            </p>
            <p className="text-sm text-amber-800 mt-1">
              {t("downgrade-next-description", {
                date: currentPeriodEnd
                  ? formatDate(currentPeriodEnd)
                  : "the end of your billing period",
              })}
            </p>
          </div>
        )}

        <Button asChild>
          <Link href="/dashboard">
            {t("go-to-dashboard")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
