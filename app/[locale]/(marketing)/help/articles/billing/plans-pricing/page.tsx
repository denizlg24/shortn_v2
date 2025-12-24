import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function PlansPricing({
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
        <h1 className="text-4xl md:text-5xl font-bold">Plans & Pricing</h1>
        <p className="text-lg text-muted-foreground">
          Choose the right plan for your needs
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Plan Overview</h2>
          <p className="text-muted-foreground">
            Shortn offers four plans designed to scale with your needs:
          </p>
        </section>

        <section className="space-y-4">
          <div className="grid gap-4">
            <div className="p-6 bg-muted rounded-lg space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">Free</h3>
                <span className="text-3xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Perfect for trying out Shortn
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />3 short links per
                  month
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />3 QR codes per
                  month
                </li>
                <li className="flex gap-2">
                  <X className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  No analytics
                </li>
                <li className="flex gap-2">
                  <X className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  No custom back-halves
                </li>
              </ul>
            </div>

            <div className="p-6 bg-muted rounded-lg space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">Basic</h3>
                <span className="text-3xl font-bold">$5</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                For individuals and small projects
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  25 links per month
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  25 QR codes per month
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  Click count analytics
                </li>
                <li className="flex gap-2">
                  <X className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  No advanced analytics
                </li>
              </ul>
            </div>

            <div className="p-6 bg-muted rounded-lg space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">Plus</h3>
                <span className="text-3xl font-bold">$15</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                For growing businesses
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  50 links per month
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  50 QR codes per month
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  Time & date analytics
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  City-level location data
                </li>
              </ul>
            </div>

            <div className="p-6 bg-muted rounded-lg border-2 border-primary space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">Pro</h3>
                <span className="text-3xl font-bold">$25</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Full-featured for professionals
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  Unlimited links & QR codes
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  Full analytics suite
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  Custom back-halves
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  Bio pages
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  Campaign tracking
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  Password protection
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  CSV export
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Monthly Limits</h2>
          <p className="text-muted-foreground">
            Free, Basic, and Plus plans have monthly creation limits that reset
            on the 1st of each month:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Limits apply only to creating new links and QR codes</li>
            <li>Existing links continue to work indefinitely</li>
            <li>Analytics remain available for all existing content</li>
            <li>Unused quota does not roll over to the next month</li>
          </ul>
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Pro Plan:</p>
            <p className="text-sm text-muted-foreground">
              No monthly limits—create as many links and QR codes as you need.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Feature Comparison</h2>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-3">Shortn.at Links</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Short Links</span>
                  <span>3 / 25 / 50 / Unlimited</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Custom Back-half
                  </span>
                  <span>Pro only</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Password Protection
                  </span>
                  <span>Pro only</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-3">QR Codes</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">QR Codes</span>
                  <span>3 / 25 / 50 / Unlimited</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Full Customization
                  </span>
                  <span>All plans</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custom Logo</span>
                  <span>Pro only</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-3">Analytics</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Click Count</span>
                  <span>Basic+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time & Date</span>
                  <span>Plus+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Device & Browser
                  </span>
                  <span>Pro only</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CSV Export</span>
                  <span>Pro only</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-3">Advanced Features</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bio Pages</span>
                  <span>Pro only</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaigns</span>
                  <span>Pro only</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UTM Builder</span>
                  <span>Pro only</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Choosing the Right Plan</h2>

          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Choose Free if:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                <li>You&apos;re trying out Shortn</li>
                <li>You need just a few links per month</li>
                <li>Analytics aren&apos;t important</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Choose Basic if:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                <li>You create 10-25 links monthly</li>
                <li>You need basic click tracking</li>
                <li>You&apos;re on a budget</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Choose Plus if:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                <li>You create 25-50 links monthly</li>
                <li>You need time-based analytics</li>
                <li>Location data is important</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Choose Pro if:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                <li>You need unlimited links</li>
                <li>You want full analytics</li>
                <li>You need bio pages or campaigns</li>
                <li>Custom branding is important</li>
                <li>You&apos;re running professional campaigns</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Billing</h2>
          <p className="text-muted-foreground">
            All paid plans are billed monthly via Polar.sh:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Secure payment processing</li>
            <li>Cancel anytime (no long-term commitment)</li>
            <li>Instant activation upon payment</li>
            <li>Automatic monthly renewal</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What&apos;s Next?</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/billing/upgrading-plans">
                <span>How to upgrade your plan</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/dashboard/subscription">
                <span>View pricing and subscribe</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>
      </article>

      <Separator />

      <div className="w-full flex justify-between items-center">
        <Button asChild variant="ghost">
          <Link href="/help">
            <ArrowLeft className="w-4 h-4" />
            Back to Help
          </Link>
        </Button>
      </div>
    </main>
  );
}
