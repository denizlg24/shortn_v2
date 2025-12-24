import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function UnderstandingAnalytics({
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
        <h1 className="text-4xl md:text-5xl font-bold">
          Understanding Analytics
        </h1>
        <p className="text-lg text-muted-foreground">
          Track and measure your link performance with powerful analytics
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Analytics by Plan</h2>
          <p className="text-muted-foreground">
            Different plans unlock different levels of analytics:
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Free Plan</p>
              <p className="text-sm text-muted-foreground">
                No analytics available
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Basic Plan</p>
              <p className="text-sm text-muted-foreground">Click count only</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Plus Plan</p>
              <p className="text-sm text-muted-foreground">
                Click count + Time & date analytics + City-level location data
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Pro Plan</p>
              <p className="text-sm text-muted-foreground">
                Full analytics: Clicks, time series, locations, devices,
                browsers, OS, referrers, and CSV export
              </p>
            </div>
          </div>
          {/* [SCREENSHOT: Analytics dashboard comparison] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Accessing Analytics</h2>
          <p className="text-muted-foreground">View analytics for any link:</p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Go to your Links dashboard</li>
            <li>Click on any link card</li>
            <li>Scroll to the Analytics section</li>
          </ol>
          {/* [SCREENSHOT: Link details page with analytics] */}
          <p className="text-muted-foreground mt-4">
            Analytics update in real-time as people click your links.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Click Count (Basic+)</h2>
          <p className="text-muted-foreground">
            The most fundamental metric shows total engagement:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Total number of clicks on your link</li>
            <li>Displayed prominently on link cards</li>
            <li>Includes all traffic (human and bot)</li>
          </ul>
          {/* [SCREENSHOT: Click count display on link card] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Time & Date Analytics (Plus+)
          </h2>
          <p className="text-muted-foreground">
            Understand when your audience is most active:
          </p>

          <div className="space-y-3 mt-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Clicks Over Time</p>
              <p className="text-sm text-muted-foreground">
                Interactive chart showing click patterns over days, weeks, or
                months
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Peak Hours</p>
              <p className="text-sm text-muted-foreground">
                Identify which hours of the day get the most engagement
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Date Ranges</p>
              <p className="text-sm text-muted-foreground">
                Filter analytics by custom date ranges
              </p>
            </div>
          </div>
          {/* [SCREENSHOT: Time series chart with date range selector] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Location Data (Plus+)</h2>
          <p className="text-muted-foreground">
            See where your clicks are coming from geographically:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Country breakdown:</strong> Top countries by click volume
            </li>
            <li>
              <strong>City-level data:</strong> Identify specific cities (Plus
              and Pro)
            </li>
            <li>
              <strong>Interactive map:</strong> Visual representation of
              geographic spread
            </li>
          </ul>
          {/* [SCREENSHOT: Geographic analytics with map] */}
          <p className="text-muted-foreground mt-4">Use location data to:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Target content for specific regions</li>
            <li>Identify expansion opportunities</li>
            <li>Schedule posts for optimal timezone reach</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Device & Browser Data (Pro)
          </h2>
          <p className="text-muted-foreground">
            Understand the technical profile of your audience:
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Device Types</p>
              <p className="text-sm text-muted-foreground">
                Desktop, mobile, and tablet breakdown
              </p>
              {/* [SCREENSHOT: Device type pie chart] */}
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Operating Systems</p>
              <p className="text-sm text-muted-foreground">
                Windows, macOS, iOS, Android, Linux distribution
              </p>
              {/* [SCREENSHOT: OS breakdown chart] */}
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Browsers</p>
              <p className="text-sm text-muted-foreground">
                Chrome, Safari, Firefox, Edge usage statistics
              </p>
              {/* [SCREENSHOT: Browser breakdown chart] */}
            </div>
          </div>

          <p className="text-muted-foreground mt-4">Use this data to:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Optimize websites for the devices your audience uses</li>
            <li>Prioritize mobile or desktop experiences</li>
            <li>Ensure browser compatibility</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Referrer Data (Pro)</h2>
          <p className="text-muted-foreground">
            See where your traffic is coming from:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Direct:</strong> People typing or clicking the link
              directly
            </li>
            <li>
              <strong>Social media:</strong> Facebook, Twitter, Instagram, etc.
            </li>
            <li>
              <strong>Search engines:</strong> Google, Bing search results
            </li>
            <li>
              <strong>Other websites:</strong> Any site linking to your content
            </li>
          </ul>
          {/* [SCREENSHOT: Referrer breakdown list] */}
          <p className="text-muted-foreground mt-4">Referrer data helps you:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Identify your most valuable traffic sources</li>
            <li>Focus marketing efforts on high-performing channels</li>
            <li>Track which partnerships drive traffic</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Exporting Data (Pro)</h2>
          <p className="text-muted-foreground">
            Export your analytics for deeper analysis:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Open link analytics</li>
            <li>Click &quot;Export to CSV&quot;</li>
            <li>Choose your date range</li>
            <li>Download the CSV file</li>
          </ol>
          {/* [SCREENSHOT: Export button and options] */}
          <p className="text-muted-foreground mt-4">
            The CSV includes all click data with timestamps, locations, devices,
            browsers, and referrers. Use this data in Excel, Google Sheets, or
            your own analytics tools.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Bot Filtering</h2>
          <p className="text-muted-foreground">
            Shortn automatically detects and labels bot traffic to give you
            accurate human engagement metrics. While all traffic is counted in
            total clicks, you can filter views to see only human visitors.
          </p>
          {/* [SCREENSHOT: Bot vs human traffic toggle] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Reading the Data</h2>
          <p className="text-muted-foreground">
            Tips for interpreting your analytics:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Look for trends over time, not just absolute numbers</li>
            <li>Compare performance across similar links</li>
            <li>Consider external factors (holidays, news events)</li>
            <li>Focus on actionable insights</li>
            <li>Set benchmarks and track improvement</li>
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
              <Link href="/help/articles/campaigns/organizing-campaigns">
                <span>Organizing campaigns</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/billing/plans-pricing">
                <span>Understanding plans and pricing</span>
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
        <Button asChild variant="outline">
          <Link href="/help/articles/campaigns/organizing-campaigns">
            Next: Organizing Campaigns
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
