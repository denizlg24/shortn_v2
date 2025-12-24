import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function GettingStarted({
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
          Getting Started with Shortn
        </h1>
        <p className="text-lg text-muted-foreground">
          Everything you need to know to start shortening links and tracking
          engagement
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Welcome to Shortn</h2>
          <p className="text-muted-foreground">
            Shortn is your all-in-one link management platform. Whether
            you&apos;re a marketer, creator, or business owner, we help you
            create short links, track engagement, and understand your audience
            better.
          </p>
          {/* [SCREENSHOT: Dashboard home view] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Creating Your First Short Link
          </h2>
          <p className="text-muted-foreground">Getting started is simple:</p>
          <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
            <li>
              From your dashboard, paste any URL into the quick create box
            </li>
            <li>
              Click &quot;Shorten&quot; to generate your short link instantly
            </li>
            <li>Copy and share your new shortn.at link anywhere</li>
          </ol>
          {/* [SCREENSHOT: Quick create widget with URL input] */}
          <p className="text-muted-foreground mt-4">
            That&apos;s it! Your link is now live and ready to track clicks.
            Want more control? Click on the link to access advanced options like
            custom back-halves, tags, and password protection.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Understanding Plans</h2>
          <p className="text-muted-foreground">
            Shortn offers four plans to fit your needs:
          </p>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Free Plan</h3>
              <p className="text-sm text-muted-foreground">
                Perfect for trying out Shortn. Create up to 3 links and 3 QR
                codes per month.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Basic Plan - $5/month</h3>
              <p className="text-sm text-muted-foreground">
                25 links and QR codes monthly with basic click tracking.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Plus Plan - $15/month</h3>
              <p className="text-sm text-muted-foreground">
                50 links monthly with time-based analytics and location data.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Pro Plan - $25/month</h3>
              <p className="text-sm text-muted-foreground">
                Unlimited links, full analytics, custom domains, bio pages,
                campaigns, and more.
              </p>
            </div>
          </div>
          {/* [SCREENSHOT: Pricing comparison table] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Navigating the Dashboard</h2>
          <p className="text-muted-foreground">
            Your dashboard is organized into key sections:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Home:</strong> Quick link creation and recent activity
              overview
            </li>
            <li>
              <strong>Links:</strong> Manage all your shortened links in one
              place
            </li>
            <li>
              <strong>QR Codes:</strong> Create and customize QR codes for your
              links
            </li>
            <li>
              <strong>Campaigns:</strong> Organize links by marketing campaigns
              (Pro only)
            </li>
            <li>
              <strong>Pages:</strong> Build custom link-in-bio pages (Pro only)
            </li>
            <li>
              <strong>Settings:</strong> Manage your account and preferences
            </li>
          </ul>
          {/* [SCREENSHOT: Dashboard sidebar navigation] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What&apos;s Next?</h2>
          <p className="text-muted-foreground">
            Now that you&apos;re familiar with the basics, explore these guides:
          </p>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/links/creating-links">
                <span>Learn about advanced link features</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/qr-codes/creating-qr-codes">
                <span>Create your first QR code</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/analytics/understanding-analytics">
                <span>Understanding your analytics</span>
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
          <Link href="/help/articles/links/creating-links">
            Next: Creating Links
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
