import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function CustomizingBioPages({
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
          Customizing Bio Pages
        </h1>
        <p className="text-lg text-muted-foreground">
          Design beautiful, branded bio pages that stand out
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Accessing Customization</h2>
          <p className="text-muted-foreground">To customize your bio page:</p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>
              Go to <strong>Pages</strong> in your dashboard
            </li>
            <li>Click on the page you want to customize</li>
            <li>
              Click the <strong>Customize</strong> tab
            </li>
          </ol>
          {/* [SCREENSHOT: Customize tab on bio page] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Profile Information</h2>
          <p className="text-muted-foreground">
            Set up your public profile that visitors will see:
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Page Title</p>
              <p className="text-sm text-muted-foreground">
                Your name or brand name displayed prominently at the top. Keep
                it short and recognizable.
              </p>
              {/* [SCREENSHOT: Title field] */}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Description</p>
              <p className="text-sm text-muted-foreground">
                A short bio, tagline, or description (optional). Great for a
                quick introduction or call-to-action.
              </p>
              {/* [SCREENSHOT: Description field] */}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Profile Picture</p>
              <p className="text-sm text-muted-foreground">
                Upload an avatar or logo. Recommended size: 400x400px, square
                format, under 2MB.
              </p>
              {/* [SCREENSHOT: Profile picture uploader] */}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Theme Colors</h2>
          <p className="text-muted-foreground">
            Make your page uniquely yours with custom colors:
          </p>

          <div className="space-y-3 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Primary Color</p>
              <p className="text-sm text-muted-foreground">
                The main accent color used for buttons and interactive elements.
                Choose a color that represents your brand.
              </p>
              {/* [SCREENSHOT: Primary color picker] */}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Button Text Color</p>
              <p className="text-sm text-muted-foreground">
                Text color for button labels. Ensure good contrast with your
                primary color for readability.
              </p>
              {/* [SCREENSHOT: Button text color picker] */}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Background</p>
              <p className="text-sm text-muted-foreground">
                Page background color. Light colors work well for professional
                looks, dark colors for creative vibes.
              </p>
              {/* [SCREENSHOT: Background color picker] */}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Text Color</p>
              <p className="text-sm text-muted-foreground">
                Main text color for titles and descriptions. Make sure it
                contrasts well with your background.
              </p>
              {/* [SCREENSHOT: Text color picker] */}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Link Customization</h2>
          <p className="text-muted-foreground">
            Customize individual links on your page:
          </p>

          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Custom Title</p>
              <p className="text-sm text-muted-foreground">
                Override the default link title with something more descriptive
                or branded
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Custom Image</p>
              <p className="text-sm text-muted-foreground">
                Add a thumbnail or icon next to each link for visual appeal
              </p>
            </div>
          </div>
          {/* [SCREENSHOT: Link customization dialog] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Link Images Best Practices</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Size:</strong> Square images work best (e.g., 200x200px)
            </li>
            <li>
              <strong>Format:</strong> PNG or JPEG, under 1MB
            </li>
            <li>
              <strong>Style:</strong> Keep a consistent style across all link
              images
            </li>
            <li>
              <strong>Contrast:</strong> Ensure images are visible against your
              background
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Color Scheme Tips</h2>
          <p className="text-muted-foreground">
            Creating an effective color scheme:
          </p>

          <div className="space-y-3 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Brand Consistency</p>
              <p className="text-sm text-muted-foreground">
                Use colors from your existing brand guidelines to maintain
                consistency across all platforms.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Contrast Matters</p>
              <p className="text-sm text-muted-foreground">
                High contrast between text and background ensures readability on
                all devices.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Test on Mobile</p>
              <p className="text-sm text-muted-foreground">
                Most visitors will view your page on mobile—make sure colors
                look good on small screens.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Accessibility</p>
              <p className="text-sm text-muted-foreground">
                Ensure your color choices meet accessibility standards for users
                with visual impairments.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Live Preview</h2>
          <p className="text-muted-foreground">
            As you make changes, the preview updates in real-time:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>See exactly how your page will look</li>
            <li>Test different color combinations</li>
            <li>Preview on desktop and mobile views</li>
            <li>Changes save automatically</li>
          </ul>
          {/* [SCREENSHOT: Live preview pane] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Reordering Links</h2>
          <p className="text-muted-foreground">
            Control the order your links appear:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Hover over a link in the editor</li>
            <li>Click and hold the drag handle icon</li>
            <li>Drag to the desired position</li>
            <li>Release to drop</li>
          </ol>
          {/* [SCREENSHOT: Drag and drop interface] */}
          <p className="text-muted-foreground mt-4">
            Pro tip: Put your most important links at the top for maximum
            visibility.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Example Themes</h2>

          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Professional</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Background: #FFFFFF (white)</li>
                <li>Text: #1F2937 (dark gray)</li>
                <li>Primary: #2563EB (blue)</li>
                <li>Button Text: #FFFFFF (white)</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Creative Dark</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Background: #0F172A (dark blue)</li>
                <li>Text: #F1F5F9 (light gray)</li>
                <li>Primary: #F59E0B (amber)</li>
                <li>Button Text: #0F172A (dark blue)</li>
              </ul>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Minimal</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Background: #F9FAFB (off-white)</li>
                <li>Text: #111827 (black)</li>
                <li>Primary: #111827 (black)</li>
                <li>Button Text: #FFFFFF (white)</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Publishing Changes</h2>
          <p className="text-muted-foreground">
            All customization changes are:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Saved automatically as you work</li>
            <li>Published immediately to your live page</li>
            <li>Visible to visitors right away</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Your bio page URL remains the same, so no need to update links on
            your social profiles.
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
              <Link href="/help/articles/analytics/understanding-analytics">
                <span>Understanding analytics</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
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
          </div>
        </section>
      </article>

      <Separator />

      <div className="w-full flex justify-between items-center">
        <Button asChild variant="ghost">
          <Link href="/help/articles/bio-pages/creating-bio-pages">
            <ArrowLeft className="w-4 h-4" />
            Previous: Creating Bio Pages
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/analytics/understanding-analytics">
            Next: Understanding Analytics
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
