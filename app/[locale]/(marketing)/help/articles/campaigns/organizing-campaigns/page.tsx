import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function OrganizingCampaigns({
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
        <h1 className="text-4xl md:text-5xl font-bold">Organizing Campaigns</h1>
        <p className="text-lg text-muted-foreground">
          Group and track links by marketing campaigns (Pro only)
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What Are Campaigns?</h2>
          <p className="text-muted-foreground">
            Campaigns help you organize related links and track performance
            across marketing initiatives. They&apos;re perfect for:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Product launches</li>
            <li>Seasonal promotions</li>
            <li>Social media campaigns</li>
            <li>Event marketing</li>
            <li>Email marketing series</li>
            <li>Partnership initiatives</li>
          </ul>
          {/* [SCREENSHOT: Campaigns dashboard view] */}
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Pro Feature:</p>
            <p className="text-sm text-muted-foreground">
              Campaigns are exclusively available to Pro plan subscribers.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Creating a Campaign</h2>
          <p className="text-muted-foreground">
            Set up a new campaign to start organizing your links:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>
              Navigate to <strong>Campaigns</strong> in your dashboard
            </li>
            <li>
              Click <strong>Create New Campaign</strong>
            </li>
            <li>Enter a campaign name</li>
            <li>Add an optional description</li>
            <li>Set start and end dates (optional)</li>
            <li>
              Click <strong>Create</strong>
            </li>
          </ol>
          {/* [SCREENSHOT: Campaign creation dialog] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Adding Links to Campaigns</h2>
          <p className="text-muted-foreground">
            There are multiple ways to add links to campaigns:
          </p>

          <div className="space-y-4 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">During Link Creation</p>
              <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
                <li>Create a new link</li>
                <li>Select a campaign from the dropdown</li>
                <li>The link is automatically added to the campaign</li>
              </ol>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">From Existing Links</p>
              <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
                <li>Open the link details page</li>
                <li>Click &quot;Edit&quot;</li>
                <li>Select or change the campaign</li>
                <li>Save changes</li>
              </ol>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">From Campaign Page</p>
              <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
                <li>Open a campaign</li>
                <li>Click &quot;Add Links&quot;</li>
                <li>Select links to include</li>
                <li>Confirm to add them</li>
              </ol>
            </div>
          </div>
          {/* [SCREENSHOT: Adding links to campaign interface] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Campaign Analytics</h2>
          <p className="text-muted-foreground">
            View aggregated analytics for all links in a campaign:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Total Clicks:</strong> Combined clicks across all campaign
              links
            </li>
            <li>
              <strong>Top Performing Links:</strong> Which links drive the most
              engagement
            </li>
            <li>
              <strong>Click Timeline:</strong> Campaign performance over time
            </li>
            <li>
              <strong>Geographic Distribution:</strong> Where campaign traffic
              comes from
            </li>
            <li>
              <strong>Traffic Sources:</strong> Which channels drive campaign
              clicks
            </li>
          </ul>
          {/* [SCREENSHOT: Campaign analytics dashboard] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Campaign vs Tags</h2>
          <p className="text-muted-foreground">
            Understanding when to use campaigns vs tags:
          </p>

          <div className="space-y-3 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Use Campaigns For:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                <li>Time-bound marketing initiatives</li>
                <li>Tracking ROI on specific efforts</li>
                <li>Projects with clear start/end dates</li>
                <li>Reporting to stakeholders</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Use Tags For:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                <li>General organization</li>
                <li>Content categories</li>
                <li>Client or project labels</li>
                <li>Quick filtering</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Managing Campaigns</h2>
          <p className="text-muted-foreground">
            Keep your campaigns organized and up-to-date:
          </p>

          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Edit Campaign Details</p>
              <p className="text-sm text-muted-foreground">
                Update name, description, and dates at any time
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Archive Campaigns</p>
              <p className="text-sm text-muted-foreground">
                Mark completed campaigns as archived to declutter your view
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Delete Campaigns</p>
              <p className="text-sm text-muted-foreground">
                Remove campaigns (links are preserved, only the grouping is
                deleted)
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Campaign Reporting</h2>
          <p className="text-muted-foreground">
            Generate reports to measure campaign success:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Open a campaign</li>
            <li>Review the analytics dashboard</li>
            <li>Export campaign data to CSV</li>
            <li>Share insights with your team</li>
          </ol>
          {/* [SCREENSHOT: Campaign report export] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Example Campaign Workflow</h2>
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <p className="font-medium">Summer Sale Campaign</p>
            <ol className="list-decimal pl-6 space-y-2 text-sm text-muted-foreground">
              <li>
                Create &quot;Summer Sale 2024&quot; campaign (June 1 - Aug 31)
              </li>
              <li>Create short links for each sale page</li>
              <li>Add UTM parameters to track channels</li>
              <li>Generate QR codes for in-store signage</li>
              <li>Monitor performance in campaign dashboard</li>
              <li>Optimize based on which links perform best</li>
              <li>Export final report after campaign ends</li>
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Best Practices</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Use clear, descriptive campaign names</li>
            <li>Set realistic start and end dates</li>
            <li>Add all related links to keep tracking consistent</li>
            <li>Review analytics weekly during active campaigns</li>
            <li>Document learnings for future campaigns</li>
            <li>Archive old campaigns to keep your list manageable</li>
            <li>Combine campaigns with UTM parameters for deeper insights</li>
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
              <Link href="/help/articles/links/utm-parameters">
                <span>Using UTM parameters</span>
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
          <Link href="/help/articles/analytics/understanding-analytics">
            <ArrowLeft className="w-4 h-4" />
            Previous: Understanding Analytics
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/billing/plans-pricing">
            Next: Plans & Pricing
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
