import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function UTMParameters({
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
        <h1 className="text-4xl md:text-5xl font-bold">UTM Parameters</h1>
        <p className="text-lg text-muted-foreground">
          Track campaign performance with UTM parameters
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What Are UTM Parameters?</h2>
          <p className="text-muted-foreground">
            UTM (Urchin Tracking Module) parameters are tags added to URLs that
            help you track the effectiveness of your marketing campaigns. They
            tell analytics tools like Google Analytics where your traffic is
            coming from.
          </p>
          {/* [SCREENSHOT: Example URL with UTM parameters highlighted] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Standard UTM Parameters</h2>
          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">utm_source</p>
              <p className="text-sm text-muted-foreground">
                Identifies where traffic is coming from (e.g., google,
                newsletter, twitter)
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                utm_source=twitter
              </code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">utm_medium</p>
              <p className="text-sm text-muted-foreground">
                Identifies the marketing medium (e.g., email, social, cpc,
                banner)
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                utm_medium=social
              </code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">utm_campaign</p>
              <p className="text-sm text-muted-foreground">
                Identifies the specific campaign (e.g., summer_sale,
                product_launch)
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                utm_campaign=summer_sale
              </code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">utm_term (optional)</p>
              <p className="text-sm text-muted-foreground">
                Identifies paid search keywords
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                utm_term=running+shoes
              </code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">utm_content (optional)</p>
              <p className="text-sm text-muted-foreground">
                Differentiates similar content or links (useful for A/B testing)
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                utm_content=header_link
              </code>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Using the UTM Builder</h2>
          <p className="text-muted-foreground">
            Pro users have access to Shortn&apos;s built-in UTM builder:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Navigate to your link details page</li>
            <li>Find the UTM Builder section</li>
            <li>Fill in the UTM parameters</li>
            <li>Click &quot;Generate UTM Link&quot;</li>
            <li>Copy and share the UTM-tagged short link</li>
          </ol>
          {/* [SCREENSHOT: UTM builder interface] */}
          <p className="text-muted-foreground mt-4">
            The builder automatically formats parameters correctly and creates a
            new short link with the UTM tags applied.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Example Use Cases</h2>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Social Media Campaign</p>
              <p className="text-sm text-muted-foreground mb-2">
                Track which social platform drives the most traffic:
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded block">
                utm_source=facebook&utm_medium=social&utm_campaign=product_launch
              </code>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Email Newsletter</p>
              <p className="text-sm text-muted-foreground mb-2">
                Measure email campaign effectiveness:
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded block">
                utm_source=newsletter&utm_medium=email&utm_campaign=weekly_digest
              </code>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Paid Advertising</p>
              <p className="text-sm text-muted-foreground mb-2">
                Track ROI on paid ads:
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded block">
                utm_source=google&utm_medium=cpc&utm_campaign=fall_sale&utm_term=winter+coats
              </code>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Best Practices</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Be consistent:</strong> Use the same naming conventions
              across all campaigns
            </li>
            <li>
              <strong>Use lowercase:</strong> UTM parameters are case-sensitive
              (utm_source=Twitter vs utm_source=twitter)
            </li>
            <li>
              <strong>Be descriptive:</strong> Clear names help you understand
              reports later
            </li>
            <li>
              <strong>Avoid spaces:</strong> Use underscores or hyphens instead
              (summer_sale, not summer sale)
            </li>
            <li>
              <strong>Document your strategy:</strong> Keep a reference of your
              UTM naming conventions
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Viewing UTM Data</h2>
          <p className="text-muted-foreground">
            While Shortn creates UTM-tagged links, the actual tracking happens
            in your analytics platform (like Google Analytics). UTM parameters
            help you:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Compare performance across channels</li>
            <li>Measure campaign ROI</li>
            <li>Identify your best traffic sources</li>
            <li>Optimize marketing spend</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Check your Google Analytics or analytics platform to see the full
            UTM data for each visit.
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
              <Link href="/help/articles/analytics/understanding-analytics">
                <span>Understanding analytics</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>
      </article>

      <Separator />

      <div className="w-full flex justify-between items-center">
        <Button asChild variant="ghost">
          <Link href="/help/articles/links/managing-links">
            <ArrowLeft className="w-4 h-4" />
            Previous: Managing Links
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/qr-codes/creating-qr-codes">
            Next: Creating QR Codes
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
