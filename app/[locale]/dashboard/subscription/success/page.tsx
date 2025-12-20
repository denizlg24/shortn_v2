import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  getSubscriptionDetails,
  getCheckoutSessionDetails,
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
                Subscription Confirmed!
              </h1>
              <p className="text-lg text-muted-foreground">
                Welcome to {planName}! Your subscription is now active.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Subscription Details
              </h2>
              <div className="rounded-lg border bg-card">
                <div className="divide-y">
                  <div className="flex justify-between p-4">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <span className="text-sm font-semibold">{planName}</span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-sm text-muted-foreground">
                      Status
                    </span>
                    <span className="text-sm font-semibold capitalize text-green-600">
                      Active
                    </span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-sm text-muted-foreground">
                      Billing Amount
                    </span>
                    <span className="text-sm font-semibold">
                      {formattedPrice}/month
                    </span>
                  </div>
                  {checkout.createdAt && (
                    <div className="flex justify-between p-4">
                      <span className="text-sm text-muted-foreground">
                        Activated On
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
                  What You Get
                </h2>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    {product.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="text-sm font-semibold text-green-900 mb-2">
              What happens next?
            </h3>
            <p className="text-sm text-green-900">
              Your subscription is now active and all features are available
              immediately. You'll be billed {formattedPrice} every month. You
              can manage your subscription or cancel at any time from your
              dashboard.
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Go to Dashboard
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
                Payment Failed
              </h1>
              <p className="text-muted-foreground">
                We couldn't process your payment. Please update your payment
                method and try again.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-900">
              Your card was declined or there was an issue processing the
              payment. This could be due to insufficient funds, an expired card,
              or your bank declining the transaction.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/dashboard/subscription">Update Payment Method</Link>
            </Button>
            <Button variant="outline" asChild size="lg">
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Handle update flow with subscription data
  if (!sid || !sig || !action) {
    redirect({ href: "/dashboard", locale });
  }

  // Type-safe at this point since we checked above
  const result = await getSubscriptionDetails(sid as string, sig as string);

  if (!result.success || !result.subscription) {
    redirect({ href: "/dashboard", locale });
  }

  // Type-safe at this point since we checked above
  const subscription = result.subscription!;
  const isUpgrade = action === "upgrade";
  const planName = subscription.product?.name || "Unknown Plan";
  const amount = subscription.amount || 0;
  const currency = subscription.currency || "USD";
  const interval = subscription.recurringInterval || "month";

  // Format price
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount / 100);

  // Calculate proration info if available
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
        {/* Header */}
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {isUpgrade ? "Subscription Updated" : "Downgrade Scheduled"}
            </h1>
            <p className="text-lg text-muted-foreground">
              {isUpgrade
                ? "Your subscription has been upgraded successfully."
                : "Your subscription will be downgraded at the end of the billing period."}
            </p>
          </div>
        </div>

        {/* Receipt-like Details */}
        <div className="space-y-6">
          {/* Subscription Details Section */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Subscription Details
            </h2>
            <div className="rounded-lg border bg-card">
              <div className="divide-y">
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="text-sm font-semibold">{planName}</span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm font-semibold capitalize">
                    {subscription.status || "Active"}
                  </span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    Billing Amount
                  </span>
                  <span className="text-sm font-semibold">
                    {formattedPrice}/{interval}
                  </span>
                </div>
                {currentPeriodEnd && (
                  <div className="flex justify-between p-4">
                    <span className="text-sm text-muted-foreground">
                      {isUpgrade ? "Next Billing Date" : "Changes Effective"}
                    </span>
                    <span className="text-sm font-medium">
                      {formatDate(currentPeriodEnd)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Product Description */}
          {subscription.product?.description && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                What You Get
              </h2>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {subscription.product.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Information Banner */}
        {isUpgrade && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              What happens next?
            </h3>
            <p className="text-sm text-blue-900">
              You'll receive an invoice for the prorated amount based on your
              remaining billing period. The charge will appear on your next
              statement, and your new features are now available immediately.
            </p>
          </div>
        )}

        {!isUpgrade && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-2">
              What happens next?
            </h3>
            <p className="text-sm text-amber-900">
              Your downgrade has been scheduled to take effect on{" "}
              {currentPeriodEnd
                ? formatDate(currentPeriodEnd)
                : "the end of your billing period"}
              . Until then, you'll continue to have access to all your current
              features. A prorated credit will automatically be applied to your
              account when the change takes effect.
            </p>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center pt-4">
          <Button asChild size="lg">
            <Link href="/dashboard">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
