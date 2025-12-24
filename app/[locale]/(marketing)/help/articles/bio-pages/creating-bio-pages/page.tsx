import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function CreatingBioPages({
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
        <h1 className="text-4xl md:text-5xl font-bold">Creating Bio Pages</h1>
        <p className="text-lg text-muted-foreground">
          Build beautiful link-in-bio pages to showcase all your important links
          (Pro only)
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What Are Bio Pages?</h2>
          <p className="text-muted-foreground">
            Bio pages (or link-in-bio pages) are custom landing pages that
            display all your important links in one place. They&apos;re perfect
            for:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Social media profiles (Instagram, TikTok, Twitter)</li>
            <li>Creator portfolios</li>
            <li>Event information hubs</li>
            <li>Product showcases</li>
            <li>Contact pages</li>
          </ul>
          {/* [SCREENSHOT: Example bio page on mobile] */}
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Pro Feature:</p>
            <p className="text-sm text-muted-foreground">
              Bio pages are exclusively available to Pro plan subscribers.
              Upgrade to create unlimited custom pages.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Creating Your First Bio Page
          </h2>
          <p className="text-muted-foreground">
            Get started with a bio page in minutes:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>
              Navigate to <strong>Pages</strong> in your dashboard
            </li>
            <li>
              Click <strong>Create New Page</strong>
            </li>
            <li>Choose a unique slug (e.g., shortn.at/b/yourname)</li>
            <li>Add a title for your page</li>
            <li>Optionally select an existing link to include</li>
            <li>
              Click <strong>Create</strong>
            </li>
          </ol>
          {/* [SCREENSHOT: Bio page creation dialog] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Choosing Your Slug</h2>
          <p className="text-muted-foreground">
            Your slug is the custom URL for your bio page. It appears as:
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <code className="text-sm">shortn.at/b/your-slug</code>
          </div>
          <p className="text-muted-foreground mt-4">
            Tips for choosing a good slug:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Keep it short and memorable</li>
            <li>Use your name or brand</li>
            <li>Only letters, numbers, and hyphens allowed</li>
            <li>Must be unique across all Shortn users</li>
            <li>Cannot be changed after creation</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Adding Links to Your Page</h2>
          <p className="text-muted-foreground">
            There are multiple ways to add links to your bio page:
          </p>

          <div className="space-y-3 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">From the Page Editor</p>
              <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
                <li>Open your bio page</li>
                <li>Click &quot;Add Link&quot;</li>
                <li>Select from your existing short links</li>
                <li>The link appears on your page immediately</li>
              </ol>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">From a Link Card</p>
              <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
                <li>Go to your Links dashboard</li>
                <li>Click the bio page icon on any link</li>
                <li>Select which page to add it to</li>
                <li>Confirm to add the link</li>
              </ol>
            </div>
          </div>
          {/* [SCREENSHOT: Add link dialog on bio page] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Customizing Links</h2>
          <p className="text-muted-foreground">
            Each link on your bio page can be customized:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Custom Title:</strong> Override the default link title
            </li>
            <li>
              <strong>Custom Image:</strong> Add a thumbnail or icon
            </li>
            <li>
              <strong>Reorder:</strong> Drag and drop links to rearrange
            </li>
          </ul>
          {/* [SCREENSHOT: Link customization on bio page] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Page Profile Settings</h2>
          <p className="text-muted-foreground">
            Personalize your bio page with profile information:
          </p>

          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Page Title</p>
              <p className="text-sm text-muted-foreground">
                Your name or brand displayed at the top
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Description</p>
              <p className="text-sm text-muted-foreground">
                A short bio or tagline (optional)
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Avatar/Profile Picture</p>
              <p className="text-sm text-muted-foreground">
                Upload an image to display as your profile picture
              </p>
            </div>
          </div>
          {/* [SCREENSHOT: Profile settings panel] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Theme Customization</h2>
          <p className="text-muted-foreground">
            Make your bio page uniquely yours with theme options:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Primary Color:</strong> Main accent color for buttons
            </li>
            <li>
              <strong>Background:</strong> Page background color or gradient
            </li>
            <li>
              <strong>Text Color:</strong> Color for all text elements
            </li>
            <li>
              <strong>Button Text Color:</strong> Color for button labels
            </li>
          </ul>
          {/* [SCREENSHOT: Theme customization panel] */}
          <p className="text-muted-foreground mt-4">
            Access theme settings from the <strong>Customize</strong> tab on
            your bio page.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Reordering Links</h2>
          <p className="text-muted-foreground">
            Control the order your links appear:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Open your bio page in edit mode</li>
            <li>Drag links by the handle icon</li>
            <li>Drop in the desired position</li>
            <li>Changes are saved automatically</li>
          </ol>
          {/* [SCREENSHOT: Drag and drop reordering] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Removing Links</h2>
          <p className="text-muted-foreground">
            To remove a link from your bio page:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Click the remove icon next to the link</li>
            <li>Confirm removal</li>
          </ol>
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Note:</p>
            <p className="text-sm text-muted-foreground">
              Removing a link from your bio page does NOT delete the short link
              itself. It only removes it from display on this page.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Sharing Your Bio Page</h2>
          <p className="text-muted-foreground">
            Once published, share your bio page URL anywhere:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Instagram, TikTok, and Twitter bios</li>
            <li>Email signatures</li>
            <li>QR codes for events</li>
            <li>Business cards</li>
            <li>YouTube descriptions</li>
          </ul>
          {/* [SCREENSHOT: Bio page URL in social media bio] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Best Practices</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Put your most important links at the top</li>
            <li>Use clear, action-oriented link titles</li>
            <li>Add custom images for visual appeal</li>
            <li>Keep your page updated with current content</li>
            <li>Use a professional profile picture</li>
            <li>Choose colors that match your brand</li>
            <li>Limit to 5-10 links for better engagement</li>
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
              <Link href="/help/articles/bio-pages/customizing-bio-pages">
                <span>Advanced customization</span>
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
          <Link href="/help">
            <ArrowLeft className="w-4 h-4" />
            Back to Help
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/bio-pages/customizing-bio-pages">
            Next: Customizing Bio Pages
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
