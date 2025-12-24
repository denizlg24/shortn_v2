import DotGrid from "@/components/DotGrid";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  BookOpen,
  CircleQuestionMark,
  MoveRight,
  ScrollText,
} from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { HelpSearch } from "@/components/marketing/help-search";

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale } = use<{ locale: string }>(params);
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto relative">
      <div className="absolute w-full h-full sm:-mt-16 -mt-12 -mx-4 -z-10">
        <div className="relative w-full h-full">
          <DotGrid
            dotSize={4}
            gap={25}
            baseColor="#f1f5f9"
            activeColor="#0f172b"
            proximity={120}
            shockRadius={250}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
          />
        </div>
      </div>

      <div className="hover:backdrop-blur-3xl transition-all px-4 sm:my-24 my-16 text-center  w-full max-w-4xl mx-auto flex flex-col items-center gap-6 ">
        <h1 className="md:text-7xl sm:text-6xl xs:text-5xl text-4xl font-black">
          How can we help you?
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl text-center">
          Search our knowledge base or browse popular topics below
        </h2>
        <HelpSearch />
      </div>
      <div className="flex flex-row items-center gap-2 w-full max-w-7xl mx-auto px-4">
        <Separator className="grow flex-1" />
        <p className="shrink-0 xs:text-sm text-xs text-muted-foreground font-medium">
          OR
        </p>
        <Separator className="grow flex-1" />
      </div>
      <div className="sm:my-20 my-12 w-full mx-auto max-w-5xl grid md:grid-cols-4 grid-cols-2 gap-4 items-stretch px-2">
        <Link
          href="/help/articles/getting-started"
          className="group w-full col-span-1 h-full"
        >
          <div className="flex flex-col items-center text-center h-full gap-4 bg-muted p-4 rounded-xl shadow-xs border  group-hover:-translate-y-px group-hover:shadow-2xl transition-all">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <BookOpen className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Getting Started
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-auto">
              Your first steps with Shortn
            </p>
          </div>
        </Link>
        <Link
          href="/help/articles/links/creating-links"
          className="group w-full col-span-1 h-full"
        >
          <div className="flex flex-col items-center text-center gap-4 bg-muted h-full p-4 rounded-xl shadow-xs border  group-hover:-translate-y-px group-hover:shadow-2xl transition-all">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <BookOpen className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">Links</h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-auto">
              Create and manage links
            </p>
          </div>
        </Link>
        <Link
          href="/help/articles/qr-codes/creating-qr-codes"
          className="group w-full col-span-1 h-full"
        >
          <div className="flex flex-col items-center text-center gap-4 bg-muted h-full p-4 rounded-xl shadow-xs border  group-hover:-translate-y-px group-hover:shadow-2xl transition-all">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <CircleQuestionMark className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              QR Codes
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-auto">
              Generate custom QR codes
            </p>
          </div>
        </Link>
        <Link
          href="/help/articles/billing/plans-pricing"
          className="group w-full col-span-1 h-full"
        >
          <div className="flex flex-col items-center text-center gap-4 bg-muted h-full p-4 rounded-xl shadow-xs border  group-hover:-translate-y-px group-hover:shadow-2xl transition-all">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <ScrollText className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Billing
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-auto">
              Plans and pricing info
            </p>
          </div>
        </Link>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 space-y-12 my-16">
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-center">Popular Articles</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/help/articles/getting-started"
              className="group p-6 bg-muted rounded-lg border hover:shadow-lg transition-all"
            >
              <h3 className="text-xl font-semibold mb-2 group-hover:underline">
                Getting Started with Shortn
              </h3>
              <p className="text-sm text-muted-foreground">
                Learn the basics of creating links, tracking analytics, and
                navigating your dashboard
              </p>
            </Link>

            <Link
              href="/help/articles/links/creating-links"
              className="group p-6 bg-muted rounded-lg border hover:shadow-lg transition-all"
            >
              <h3 className="text-xl font-semibold mb-2 group-hover:underline">
                Creating Short Links
              </h3>
              <p className="text-sm text-muted-foreground">
                Master link creation with custom back-halves, password
                protection, and tags
              </p>
            </Link>

            <Link
              href="/help/articles/analytics/understanding-analytics"
              className="group p-6 bg-muted rounded-lg border hover:shadow-lg transition-all"
            >
              <h3 className="text-xl font-semibold mb-2 group-hover:underline">
                Understanding Analytics
              </h3>
              <p className="text-sm text-muted-foreground">
                Track clicks, locations, devices, and measure your link
                performance
              </p>
            </Link>

            <Link
              href="/help/articles/qr-codes/creating-qr-codes"
              className="group p-6 bg-muted rounded-lg border hover:shadow-lg transition-all"
            >
              <h3 className="text-xl font-semibold mb-2 group-hover:underline">
                Creating QR Codes
              </h3>
              <p className="text-sm text-muted-foreground">
                Generate and customize QR codes for print and digital use
              </p>
            </Link>

            <Link
              href="/help/articles/bio-pages/creating-bio-pages"
              className="group p-6 bg-muted rounded-lg border hover:shadow-lg transition-all"
            >
              <h3 className="text-xl font-semibold mb-2 group-hover:underline">
                Creating Bio Pages
              </h3>
              <p className="text-sm text-muted-foreground">
                Build beautiful link-in-bio pages for Instagram, TikTok, and
                more (Pro)
              </p>
            </Link>

            <Link
              href="/help/articles/billing/plans-pricing"
              className="group p-6 bg-muted rounded-lg border hover:shadow-lg transition-all"
            >
              <h3 className="text-xl font-semibold mb-2 group-hover:underline">
                Plans & Pricing
              </h3>
              <p className="text-sm text-muted-foreground">
                Compare plans and find the perfect fit for your needs
              </p>
            </Link>
          </div>
        </section>

        <Separator />

        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-center">All Categories</h2>

          <div className="grid md:grid-cols-3 xs:grid-cols-2 gap-6 items-center">
            <div className="space-y-3 mx-auto text-center">
              <h3 className="text-xl font-semibold">Links</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/help/articles/links/creating-links"
                    className="text-muted-foreground hover:underline"
                  >
                    Creating Links
                  </Link>
                </li>
                <li>
                  <Link
                    href="/help/articles/links/managing-links"
                    className="text-muted-foreground hover:underline"
                  >
                    Managing Links
                  </Link>
                </li>
                <li>
                  <Link
                    href="/help/articles/links/utm-parameters"
                    className="text-muted-foreground hover:underline"
                  >
                    UTM Parameters
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3 mx-auto text-center">
              <h3 className="text-xl font-semibold">QR Codes</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/help/articles/qr-codes/creating-qr-codes"
                    className="text-muted-foreground hover:underline"
                  >
                    Creating QR Codes
                  </Link>
                </li>
                <li>
                  <Link
                    href="/help/articles/qr-codes/managing-qr-codes"
                    className="text-muted-foreground hover:underline"
                  >
                    Managing QR Codes
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3 mx-auto text-center">
              <h3 className="text-xl font-semibold">Bio Pages</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/help/articles/bio-pages/creating-bio-pages"
                    className="text-muted-foreground hover:underline"
                  >
                    Creating Bio Pages
                  </Link>
                </li>
                <li>
                  <Link
                    href="/help/articles/bio-pages/customizing-bio-pages"
                    className="text-muted-foreground hover:underline"
                  >
                    Customizing Bio Pages
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3 mx-auto text-center">
              <h3 className="text-xl font-semibold">Analytics</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/help/articles/analytics/understanding-analytics"
                    className="text-muted-foreground hover:underline"
                  >
                    Understanding Analytics
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3 mx-auto text-center">
              <h3 className="text-xl font-semibold">Campaigns</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/help/articles/campaigns/organizing-campaigns"
                    className="text-muted-foreground hover:underline"
                  >
                    Organizing Campaigns
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3 mx-auto text-center">
              <h3 className="text-xl font-semibold">Billing</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/help/articles/billing/plans-pricing"
                    className="text-muted-foreground hover:underline"
                  >
                    Plans & Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/help/articles/billing/upgrading-plans"
                    className="text-muted-foreground hover:underline"
                  >
                    Upgrading Plans
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
      <div className="w-full bg-muted px-4 py-12 border-b-2">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto gap-6">
          <h1 className="md:text-4xl sm:text-3xl xs:text-2xl text-xl font-bold">
            Still need help?
          </h1>
          <h2 className="text-lg text-muted-foreground max-w-xl">
            Can't find what you're looking for? Our support team is here to
            help.
          </h2>
          <Button asChild className="rounded-full w-full max-w-sm" size={"lg"}>
            <Link href={"/contact"}>
              Contact us <MoveRight />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
