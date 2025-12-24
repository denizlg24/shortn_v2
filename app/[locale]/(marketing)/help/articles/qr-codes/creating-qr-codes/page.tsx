import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function CreatingQRCodes({
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
        <h1 className="text-4xl md:text-5xl font-bold">Creating QR Codes</h1>
        <p className="text-lg text-muted-foreground">
          Generate custom QR codes for your links and track scans
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What Are QR Codes?</h2>
          <p className="text-muted-foreground">
            QR (Quick Response) codes are scannable barcodes that direct users
            to URLs. They&apos;re perfect for:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Print materials (flyers, posters, business cards)</li>
            <li>Product packaging</li>
            <li>Event signage</li>
            <li>Restaurant menus</li>
            <li>Retail displays</li>
          </ul>
          {/* [SCREENSHOT: Example QR code being scanned with phone] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Creating Your First QR Code
          </h2>
          <p className="text-muted-foreground">
            There are two ways to create QR codes in Shortn:
          </p>

          <div className="space-y-4 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">
                Method 1: From an Existing Link
              </p>
              <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
                <li>Go to your Links dashboard</li>
                <li>Click the QR code icon on any link card</li>
                <li>Customize your QR code design</li>
                <li>Download and use</li>
              </ol>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Method 2: Create QR Code First</p>
              <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
                <li>
                  Navigate to <strong>QR Codes</strong> →{" "}
                  <strong>Create New</strong>
                </li>
                <li>Enter your destination URL</li>
                <li>Customize the design</li>
                <li>Optionally create a short link to track clicks</li>
              </ol>
            </div>
          </div>
          {/* [SCREENSHOT: QR code creation interface] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">QR Code Configuration</h2>
          <p className="text-muted-foreground">
            Start by configuring your QR code basics:
          </p>

          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Destination URL</p>
              <p className="text-sm text-muted-foreground">
                The website or link people will visit when they scan
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Title</p>
              <p className="text-sm text-muted-foreground">
                Internal name to help you identify this QR code
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Tags</p>
              <p className="text-sm text-muted-foreground">
                Organize your QR codes with tags
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Dynamic Link</p>
              <p className="text-sm text-muted-foreground">
                Create a short link to track both QR scans and link clicks
              </p>
            </div>
          </div>
          {/* [SCREENSHOT: QR code configuration tab] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Customizing Design</h2>
          <p className="text-muted-foreground">
            Make your QR codes match your brand with full customization:
          </p>

          <div className="space-y-3 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Dot Style</p>
              <p className="text-sm text-muted-foreground">
                Choose from various patterns: square, rounded, dots, classy,
                extra-rounded
              </p>
              {/* [SCREENSHOT: Dot style options] */}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Colors</p>
              <p className="text-sm text-muted-foreground">
                Customize dot color and background color to match your brand
              </p>
              {/* [SCREENSHOT: Color picker interface] */}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Corner Styles</p>
              <p className="text-sm text-muted-foreground">
                Modify the corner squares and dots for unique looks
              </p>
              {/* [SCREENSHOT: Corner style options] */}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Logo Upload (Pro)</p>
              <p className="text-sm text-muted-foreground">
                Add your company logo to the center of the QR code
              </p>
              {/* [SCREENSHOT: QR code with logo in center] */}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Download Options</h2>
          <p className="text-muted-foreground">
            Download your QR codes in multiple formats:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>PNG:</strong> Best for digital use and presentations
            </li>
            <li>
              <strong>JPEG:</strong> Smaller file size, good for web
            </li>
            <li>
              <strong>SVG:</strong> Scalable vector format, perfect for print at
              any size
            </li>
          </ul>
          {/* [SCREENSHOT: Download format options] */}
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Pro Tip:</p>
            <p className="text-sm text-muted-foreground">
              Use SVG format for print materials to ensure your QR code looks
              crisp at any size.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Dynamic vs Static QR Codes</h2>
          <p className="text-muted-foreground">
            Understanding the difference helps you choose the right type:
          </p>

          <div className="space-y-3 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Static QR Codes</p>
              <p className="text-sm text-muted-foreground mb-2">
                Encode the destination URL directly in the QR code
              </p>
              <p className="text-sm text-muted-foreground">
                ✓ Work forever without an account
                <br />
                ✗ Cannot change destination after printing
                <br />✗ Limited analytics
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">
                Dynamic QR Codes (with Short Link)
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Encode a short link that redirects to your destination
              </p>
              <p className="text-sm text-muted-foreground">
                ✓ Change destination URL anytime
                <br />
                ✓ Track scans and analytics
                <br />✓ Update content without reprinting
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Best Practices</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Test your QR code before printing at scale</li>
            <li>Ensure good contrast between dots and background</li>
            <li>Don&apos;t make QR codes too small (minimum 2cm × 2cm)</li>
            <li>Place QR codes at eye level when possible</li>
            <li>Add a call-to-action (&quot;Scan to learn more&quot;)</li>
            <li>Use dynamic QR codes for physical materials</li>
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
              <Link href="/help/articles/qr-codes/managing-qr-codes">
                <span>Managing your QR codes</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/analytics/understanding-analytics">
                <span>Tracking QR code scans</span>
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
          <Link href="/help/articles/qr-codes/managing-qr-codes">
            Next: Managing QR Codes
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
