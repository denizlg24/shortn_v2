import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function UpgradingPlans({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale } = use<{ locale: string }>(params);
  setRequestLocale(locale);

  return (
    <main className="flex flex-col items-start w-full max-w-4xl mx-auto px-4 py-12 gap-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/help">
          <ArrowLeft className="w-4 h-4" />
          Back to Help
        </Link>
      </Button>

      <div className="w-full space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold">Upgrading Your Plan</h1>
        <p className="text-lg text-muted-foreground">
          Learn how to upgrade, downgrade, and manage your subscription
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">How to Upgrade</h2>
          <p className="text-muted-foreground">
            Upgrading your plan takes just a few seconds:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>
              Navigate to <strong>Settings</strong> →{" "}
              <strong>Subscription</strong>
            </li>
            <li>Review the available plans</li>
            <li>
              Click <strong>Upgrade</strong> on your desired plan
            </li>
            <li>Complete payment through Polar.sh</li>
            <li>Your new features are available immediately</li>
          </ol>
          {/* [SCREENSHOT: Subscription page with upgrade buttons] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Upgrade Timing</h2>
          <p className="text-muted-foreground">
            When you upgrade to a higher plan:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>New features are activated instantly</li>
            <li>
              You&apos;re charged the prorated difference for the current
              billing period
            </li>
            <li>Your next bill will be at the new plan rate</li>
            <li>Monthly limits update immediately (more links available)</li>
          </ul>
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Example:</p>
            <p className="text-sm text-muted-foreground">
              Upgrading from Basic ($5) to Pro ($25) mid-month means you pay
              ~$10 prorated for the remaining days, then $25/month going
              forward.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Downgrading Your Plan</h2>
          <p className="text-muted-foreground">
            You can downgrade to a lower plan at any time:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>
              Go to <strong>Settings</strong> → <strong>Subscription</strong>
            </li>
            <li>
              Click <strong>Change Plan</strong>
            </li>
            <li>Select the lower tier plan</li>
            <li>Confirm the change</li>
          </ol>

          <p className="text-muted-foreground mt-4">
            Important notes about downgrading:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              Changes take effect at the end of your current billing period
            </li>
            <li>You keep all current features until then</li>
            <li>Existing links continue to work</li>
            <li>Some features may become view-only (campaigns, bio pages)</li>
          </ul>
          {/* [SCREENSHOT: Downgrade confirmation dialog] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What Happens to Your Data</h2>
          <p className="text-muted-foreground">
            When downgrading, your data is preserved:
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Links</p>
              <p className="text-sm text-muted-foreground">
                All existing links continue to work. You just can&apos;t create
                new ones if you exceed the new limit.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">QR Codes</p>
              <p className="text-sm text-muted-foreground">
                Existing QR codes remain functional. Custom logos may be removed
                on Pro-only designs.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Analytics</p>
              <p className="text-sm text-muted-foreground">
                Historical data is preserved but you&apos;ll only see data
                allowed by your new plan (e.g., Plus can&apos;t see device
                data).
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Bio Pages (Pro)</p>
              <p className="text-sm text-muted-foreground">
                Pages become view-only on lower plans. They remain live but you
                can&apos;t edit them.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Campaigns (Pro)</p>
              <p className="text-sm text-muted-foreground">
                Campaign data is preserved but you can&apos;t create or edit
                campaigns on lower plans.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Canceling Your Subscription
          </h2>
          <p className="text-muted-foreground">
            To cancel and return to the Free plan:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>
              Go to <strong>Settings</strong> → <strong>Subscription</strong>
            </li>
            <li>
              Click <strong>Cancel Subscription</strong>
            </li>
            <li>Confirm cancellation</li>
          </ol>

          <p className="text-muted-foreground mt-4">After cancellation:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>You keep Pro features until the end of your billing period</li>
            <li>No further charges are made</li>
            <li>You revert to Free plan limits after the period ends</li>
            <li>You can resubscribe at any time</li>
          </ul>
          {/* [SCREENSHOT: Cancel subscription confirmation] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Resubscribing</h2>
          <p className="text-muted-foreground">
            Changed your mind? You can easily resubscribe:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>All your old data is intact</li>
            <li>Simply select a plan and subscribe again</li>
            <li>Previous features and content are restored</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Payment Methods</h2>
          <p className="text-muted-foreground">
            Manage your payment method through Polar.sh:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Visit your Polar.sh dashboard</li>
            <li>Update credit card information</li>
            <li>View billing history and invoices</li>
          </ol>
          {/* [SCREENSHOT: Polar.sh payment management link] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Billing Support</h2>
          <p className="text-muted-foreground">
            Need help with billing issues?
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Check your Polar.sh account for invoice details</li>
            <li>Contact support through the help center</li>
            <li>Email us with billing questions</li>
          </ul>
          <Button asChild className="mt-4">
            <Link href="/contact">Contact Support</Link>
          </Button>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Refund Policy</h2>
          <p className="text-muted-foreground">
            We offer refunds on a case-by-case basis within 14 days of initial
            subscription. Contact support with your reason and we&apos;ll do our
            best to help.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What&apos;s Next?</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/billing/plans-pricing">
                <span>Compare all plans</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/dashboard/subscription">
                <span>Manage your subscription</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>
      </article>

      <Separator />

      <div className="w-full flex justify-between items-center">
        <Button asChild variant="ghost">
          <Link href="/help/articles/billing/plans-pricing">
            <ArrowLeft className="w-4 h-4" />
            Previous: Plans & Pricing
          </Link>
        </Button>
      </div>
    </main>
  );
}
