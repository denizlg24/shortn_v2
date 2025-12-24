import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function ManagingQRCodes({
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
        <h1 className="text-4xl md:text-5xl font-bold">Managing QR Codes</h1>
        <p className="text-lg text-muted-foreground">
          Edit, download, and organize your QR codes
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Viewing Your QR Codes</h2>
          <p className="text-muted-foreground">
            Access all your QR codes from the <strong>QR Codes</strong> section
            in your dashboard. Similar to links, you can:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Search by title or destination URL</li>
            <li>Filter by tags or creation date</li>
            <li>Sort by date, scans, or title</li>
            <li>View QR codes with or without attached links</li>
          </ul>
          {/* [SCREENSHOT: QR codes dashboard] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">QR Code Cards</h2>
          <p className="text-muted-foreground">
            Each QR code displays as a card with:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Preview of the QR code design</li>
            <li>Title and destination URL</li>
            <li>Tags for organization</li>
            <li>Scan count (if dynamic)</li>
            <li>Quick action buttons</li>
          </ul>
          {/* [SCREENSHOT: QR code card with labels] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Editing QR Codes</h2>
          <p className="text-muted-foreground">
            Click any QR code card to access the details page where you can:
          </p>

          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Update Design</p>
              <p className="text-sm text-muted-foreground">
                Change colors, patterns, and corner styles at any time
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Modify Title and Tags</p>
              <p className="text-sm text-muted-foreground">
                Update internal organization without affecting the QR code
                itself
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">
                Change Destination (Dynamic Only)
              </p>
              <p className="text-sm text-muted-foreground">
                If linked to a short link, update where the QR code redirects
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Add/Remove Logo (Pro)</p>
              <p className="text-sm text-muted-foreground">
                Upload or change the center logo
              </p>
            </div>
          </div>
          {/* [SCREENSHOT: QR code edit interface] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Downloading QR Codes</h2>
          <p className="text-muted-foreground">
            Multiple download options are available on every QR code:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Open the QR code details page</li>
            <li>Select your preferred format (PNG, JPEG, or SVG)</li>
            <li>Click the download button</li>
            <li>The file is saved to your device</li>
          </ol>
          {/* [SCREENSHOT: Download buttons and format options] */}
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Remember:</p>
            <p className="text-sm text-muted-foreground">
              You can re-download QR codes as many times as needed. Any design
              changes you make will be reflected in new downloads.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Linking QR Codes to Short Links
          </h2>
          <p className="text-muted-foreground">
            Creating a dynamic QR code by linking it to a short link enables:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Scan tracking and analytics</li>
            <li>Ability to change the destination URL</li>
            <li>Combined click and scan metrics</li>
            <li>Password protection (Pro only)</li>
          </ul>

          <p className="text-muted-foreground mt-4">To link a QR code:</p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Open the QR code details page</li>
            <li>Click &quot;Create Short Link&quot;</li>
            <li>The short link is created and automatically linked</li>
          </ol>
          {/* [SCREENSHOT: Create short link button on QR code page] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Viewing Scan Analytics</h2>
          <p className="text-muted-foreground">
            For QR codes linked to short links, view detailed analytics:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Total scans over time</li>
            <li>Geographic location data (Plus and Pro)</li>
            <li>Device and OS information (Pro)</li>
            <li>Time and date breakdowns (Plus and Pro)</li>
          </ul>
          {/* [SCREENSHOT: QR code analytics page] */}
          <p className="text-muted-foreground mt-4">
            Access analytics by clicking &quot;View Short Link&quot; from the QR
            code page.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Organizing with Tags</h2>
          <p className="text-muted-foreground">
            Use tags to organize QR codes by:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Campaign or event</li>
            <li>Physical location (storefront, event booth)</li>
            <li>Content type (menu, brochure, poster)</li>
            <li>Client or project</li>
          </ul>
          {/* [SCREENSHOT: QR codes filtered by tag] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Deleting QR Codes</h2>
          <p className="text-muted-foreground">
            To permanently delete a QR code:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Open the QR code details page</li>
            <li>Click the menu (three dots)</li>
            <li>Select &quot;Delete&quot;</li>
            <li>Confirm the deletion</li>
          </ol>
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Important:</p>
            <p className="text-sm text-muted-foreground">
              Deleting a QR code does NOT delete its linked short link. If you
              want to delete both, you must delete each separately.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What&apos;s Next?</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/bio-pages/creating-bio-pages">
                <span>Creating bio pages</span>
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
          <Link href="/help/articles/qr-codes/creating-qr-codes">
            <ArrowLeft className="w-4 h-4" />
            Previous: Creating QR Codes
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/bio-pages/creating-bio-pages">
            Next: Creating Bio Pages
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
