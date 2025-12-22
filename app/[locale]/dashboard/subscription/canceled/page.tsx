import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowRight, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function SubscriptionCanceledPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    scheduled?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { scheduled } = await searchParams;

  if (!scheduled) {
    redirect({ href: "/dashboard", locale });
  }

  const scheduledDate = new Date(scheduled as string);
  const formattedDate = scheduledDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex w-full pt-12 justify-center px-4 pb-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <CalendarX className="h-16 w-16 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Cancellation Scheduled
            </h1>
            <p className="text-lg text-muted-foreground">
              Your subscription has been set to cancel at the end of your
              billing period.
            </p>
          </div>
        </div>

        {/* Cancellation Details */}
        <div className="space-y-6">
          {/* Main Details Section */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cancellation Details
            </h2>
            <div className="rounded-lg border bg-card">
              <div className="divide-y">
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    Effective Date
                  </span>
                  <span className="text-sm font-semibold">{formattedDate}</span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm font-semibold text-amber-600">
                    Pending Cancellation
                  </span>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    Access Until
                  </span>
                  <span className="text-sm font-semibold">{formattedDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* What Happens Next Section */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              What Happens Next
            </h2>
            <div className="rounded-lg border bg-card p-4">
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="text-muted-foreground mt-0.5">1.</span>
                  <span>
                    You'll continue to have <strong>full access</strong> to all
                    features until <strong>{formattedDate}</strong>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-muted-foreground mt-0.5">2.</span>
                  <span>
                    On <strong>{formattedDate}</strong>, your subscription will
                    automatically end and you'll be downgraded to the free plan
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-muted-foreground mt-0.5">3.</span>
                  <span>
                    You won't be charged for any future billing periods
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-muted-foreground mt-0.5">4.</span>
                  <span>
                    Your data will be retained according to our data retention
                    policy
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Information Banner */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900 mb-2">
            Changed your mind?
          </h3>
          <p className="text-sm text-amber-900 mb-3">
            You can reactivate your subscription at any time before{" "}
            {formattedDate}. Simply visit your subscription settings and choose
            a plan.
          </p>
          <Button asChild variant="outline" size="sm" className="bg-white">
            <Link href="/dashboard/subscription">
              View Subscription Settings
            </Link>
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/dashboard">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Feedback Section */}
        <div className="rounded-lg border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            We appreciate your feedback. If you have any questions or concerns,
            please{" "}
            <Link
              href="/contact"
              className="font-medium text-foreground underline underline-offset-4"
            >
              contact our support team
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
