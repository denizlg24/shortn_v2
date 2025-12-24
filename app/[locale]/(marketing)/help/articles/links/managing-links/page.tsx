import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function ManagingLinks({
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
        <h1 className="text-4xl md:text-5xl font-bold">Managing Your Links</h1>
        <p className="text-lg text-muted-foreground">
          Edit, organize, and control your shortened links
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Finding Your Links</h2>
          <p className="text-muted-foreground">
            Access all your links from the <strong>Links</strong> section in
            your dashboard. The links page provides powerful filtering and
            search:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Search by title or destination URL</li>
            <li>Filter by tags, campaigns, or date range</li>
            <li>Sort by creation date, clicks, or title</li>
            <li>View links with or without QR codes</li>
          </ul>
          {/* [SCREENSHOT: Links dashboard with filters and search] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Link Cards</h2>
          <p className="text-muted-foreground">
            Each link is displayed as a card showing key information:
          </p>
          {/* [SCREENSHOT: Link card with all elements labeled] */}
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Title and URL:</strong> Link identifier and short URL
            </li>
            <li>
              <strong>Tags:</strong> Organization labels
            </li>
            <li>
              <strong>Click count:</strong> Total engagement
            </li>
            <li>
              <strong>Creation date:</strong> When the link was created
            </li>
            <li>
              <strong>Quick actions:</strong> Copy, QR code, details, password
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Editing Links</h2>
          <p className="text-muted-foreground">
            Click on any link card to access detailed options:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Click the link card or &quot;View link details&quot;</li>
            <li>Click the &quot;Edit&quot; button</li>
            <li>Modify the title, tags, or destination URL</li>
            <li>Add or remove password protection</li>
            <li>Save your changes</li>
          </ol>
          {/* [SCREENSHOT: Link edit dialog] */}
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Note:</p>
            <p className="text-sm text-muted-foreground">
              The short URL code cannot be changed after creation. If you need a
              different code, create a new link with your desired custom
              back-half.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Copying Links</h2>
          <p className="text-muted-foreground">
            Quickly copy your short links to share them:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              Click the <strong>Copy</strong> button on any link card
            </li>
            <li>Or click the copy icon in the link details page</li>
            <li>The URL is copied to your clipboard and ready to paste</li>
          </ul>
          {/* [SCREENSHOT: Copy button on link card] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Link Actions</h2>
          <p className="text-muted-foreground">
            Each link card provides quick access to common actions:
          </p>
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">View Details</p>
              <p className="text-sm text-muted-foreground">
                See full analytics, edit settings, and access advanced options
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Create QR Code</p>
              <p className="text-sm text-muted-foreground">
                Generate a custom QR code for this link
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Add to Bio Page</p>
              <p className="text-sm text-muted-foreground">
                Include this link on your link-in-bio page (Pro only)
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Password Protection</p>
              <p className="text-sm text-muted-foreground">
                Add, update, or remove password protection (Pro only)
              </p>
            </div>
          </div>
          {/* [SCREENSHOT: Link card action buttons] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Deleting Links</h2>
          <p className="text-muted-foreground">To delete a link permanently:</p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Click the menu button (three dots) on the link card</li>
            <li>Select &quot;Delete&quot;</li>
            <li>Confirm the deletion</li>
          </ol>
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Warning:</p>
            <p className="text-sm text-muted-foreground">
              Deleted links cannot be recovered. The short URL will become
              available for others to use, and all analytics data will be
              permanently removed.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Bulk Operations</h2>
          <p className="text-muted-foreground">
            Manage multiple links efficiently:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Use filters to find groups of related links</li>
            <li>Export analytics data to CSV for multiple links</li>
            <li>Apply tags to organize similar links</li>
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
                <span>Learn about UTM parameters</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/analytics/understanding-analytics">
                <span>Understanding link analytics</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>
      </article>

      <Separator />

      <div className="w-full flex justify-between items-center">
        <Button asChild variant="ghost">
          <Link href="/help/articles/links/creating-links">
            <ArrowLeft className="w-4 h-4" />
            Previous: Creating Links
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/links/utm-parameters">
            Next: UTM Parameters
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
