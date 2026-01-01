import DotGrid from "@/components/DotGrid";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { RotatingSubtitle } from "./_components/rotating-subtitle";
import { Button } from "@/components/ui/button";
import {
  Check,
  MoveRight,
  Zap,
  Link2,
  QrCode,
  BarChart3,
  Globe,
  Shield,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import GradientText from "@/components/GradientText";

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
      <div className="hover:backdrop-blur-3xl transition-all sm:mt-24 mt-16 mx-auto max-w-4xl text-center w-full px-4 flex flex-col items-center gap-6 z-10">
        <div className="rounded-full py-1.5 px-4 bg-muted border shadow flex items-center justify-center gap-2 text-muted-foreground">
          <Zap className="w-4 h-4" />
          <span className="text-sm font-medium">
            85% cheaper than competitors
          </span>
        </div>
        <h1 className="md:text-7xl sm:text-6xl xs:text-5xl text-4xl font-black">
          The low-cost option for brand management
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl">
          Shorten URLs, generate QR codes, track analytics, and create
          link-in-bio pages. Everything you need at a fraction of the cost.
        </h2>
        {/* <RotatingSubtitle
          texts={[
            "Link shortener",
            "QR Code creator",
            "Marketing platform",
            "Analytics dashboard",
            "Personal page",
          ]}
        /> */}
        <div className="flex sm:flex-row flex-col gap-2 items-center justify-center w-full">
          <Button asChild size={"lg"} className="rounded-full w-full sm:flex-1">
            <Link href={"/register"}>
              Get started for <span className="-ml-1 font-bold">free</span>{" "}
              <MoveRight />
            </Link>
          </Button>
          <Button
            asChild
            variant={"outline"}
            size={"lg"}
            className="rounded-full w-full sm:flex-1"
          >
            <Link href={"/pricing"}>Compare plans</Link>
          </Button>
        </div>
        <div className="w-full max-w-xl flex flex-row items-center justify-center flex-wrap gap-y-2 gap-x-0.5">
          <div className="grow flex flex-row items-center justify-center text-center gap-2 text-muted-foreground text-xs">
            <Check className="w-4 h-4" />
            No credit card required
          </div>
          <div className="grow flex flex-row items-center justify-center text-center gap-2 text-muted-foreground text-xs">
            <Check className="w-4 h-4" />
            No onboarding required
          </div>
          <div className="grow flex flex-row items-center justify-center text-center gap-2 text-muted-foreground text-xs">
            <Check className="w-4 h-4" />
            Free forever plan available
          </div>
        </div>
      </div>
      <div className="w-full bg-muted/50 border px-2 py-6 sm:my-20 my-12 ">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-4 text-center">
          <div className="flex flex-col gap-2 col-span-1 w-full items-center">
            <span className="md:text-3xl sm:text-2xl xs:text-xl text-lg font-bold">
              85%
            </span>
            <span className="sm:text-base text-xs text-muted-foreground">
              More <br className="xs:hidden block" /> affordable
            </span>
          </div>
          <div className="flex flex-col gap-2 col-span-1 w-full items-center">
            <span className="md:text-3xl sm:text-2xl xs:text-xl text-lg font-bold">
              99%
            </span>
            <span className="sm:text-base text-xs text-muted-foreground">
              Uptime <br className="xs:hidden block" /> SLA
            </span>
          </div>
          <div className="flex flex-col gap-2 col-span-1 w-full items-center">
            <span className="md:text-3xl sm:text-2xl xs:text-xl text-lg font-bold">
              5K
              <span className="text-sm xs:text-base sm:text-lg md:text-xl">
                +
              </span>
            </span>
            <span className="sm:text-base text-xs text-muted-foreground">
              Links <br className="xs:hidden block" /> shortened
            </span>
          </div>
          <div className="flex flex-col gap-2 col-span-1 w-full items-center">
            <span className="md:text-3xl sm:text-2xl xs:text-xl text-lg font-bold">
              35
              <span className="text-sm xs:text-base sm:text-lg md:text-xl">
                +
              </span>
            </span>
            <span className="sm:text-base text-xs text-muted-foreground">
              Countries <br className="xs:hidden block" /> reached
            </span>
          </div>
        </div>
      </div>
      <div className="hover:backdrop-blur-3xl mx-auto max-w-5xl flex flex-col gap-4 items-center sm:mb-20 mb-12 px-4">
        <h1 className="wrap-break-word md:text-3xl xs:text-2xl font-medium text-xl text-center">
          <GradientText
            colors={["#131954", " #4079ff", " #131954", " #4079ff", "#131954"]}
            animationSpeed={8}
            showBorder={false}
            className="inline-flex rounded-none! wrap-break-word"
          >
            Level up
          </GradientText>{" "}
          your marketing strategy with{" "}
          <GradientText
            colors={["#131954", " #4079ff", " #131954", " #4079ff", "#131954"]}
            animationSpeed={8}
            showBorder={false}
            className="inline-flex rounded-none! wrap-break-word"
          >
            Shortn.at
          </GradientText>
        </h1>
        <RotatingSubtitle
          texts={[
            "Link shortener",
            "QR Code generator",
            "Marketing platform",
            "Analytics dashboard",
            "Personal page",
          ]}
        />
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 sm:mb-20 mb-12">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="group bg-background border rounded-xl p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <Link2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Shorten Links</h3>
            <p className="text-muted-foreground text-sm">
              Transform long URLs into memorable, branded short links that drive
              clicks and build trust.
            </p>
          </div>
          <div className="group bg-background border rounded-xl p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <QrCode className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Generate QR Codes</h3>
            <p className="text-muted-foreground text-sm">
              Create stunning, customizable QR codes with your brand colors and
              logo in seconds.
            </p>
          </div>
          <div className="group bg-background border rounded-xl p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-300">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Track Analytics</h3>
            <p className="text-muted-foreground text-sm">
              Get real-time insights on clicks, locations, devices, and more to
              optimize your campaigns.
            </p>
          </div>
        </div>
      </div>

      {/*Hopefully we will have testimonies soon enough */}
      {/* <div className="w-full bg-muted/50 border-y py-16 sm:mb-20 mb-12">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-center text-2xl font-bold mb-2">
            Trusted by marketers worldwide
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            See what our users are saying
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-background rounded-xl p-6 border shadow-sm">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-4 h-4 text-yellow-400 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                &ldquo;Finally, a link shortener that doesn&apos;t cost a fortune. The
                analytics are just as good as the big players.&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-400 to-purple-500" />
                <div>
                  <p className="font-medium text-sm">Sarah M.</p>
                  <p className="text-xs text-muted-foreground">
                    Marketing Manager
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-background rounded-xl p-6 border shadow-sm flex flex-col">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-4 h-4 text-yellow-400 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                &ldquo;The QR code customization is incredible. Our branded codes look
                so professional now.&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-400 to-teal-500" />
                <div>
                  <p className="font-medium text-sm">James K.</p>
                  <p className="text-xs text-muted-foreground">Small Business Owner</p>
                </div>
              </div>
            </div>
            <div className="bg-background rounded-xl p-6 border shadow-sm">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-4 h-4 text-yellow-400 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                &ldquo;Switched from Bitly and saving over $200/month. Same features,
                fraction of the price.&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-orange-400 to-red-500" />
                <div>
                  <p className="font-medium text-sm">Alex R.</p>
                  <p className="text-xs text-muted-foreground">Content Creator</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> */}

      <div className="w-full max-w-6xl mx-auto px-4 sm:mb-20 mb-12">
        <h2 className="text-center text-2xl font-bold mb-2">
          Why choose Shortn.at?
        </h2>
        <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
          We built the tool we wished existed — powerful, affordable, and easy
          to use.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-lg border bg-background">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Secure & Private</h4>
              <p className="text-xs text-muted-foreground">
                Your data is encrypted and never sold to third parties.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg border bg-background">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Lightning Fast</h4>
              <p className="text-xs text-muted-foreground">
                Sub-100ms redirects with our global edge network.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg border bg-background">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Global Analytics</h4>
              <p className="text-xs text-muted-foreground">
                Track clicks from every country in real-time.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg border bg-background">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h4 className="font-medium mb-1">No Setup Needed</h4>
              <p className="text-xs text-muted-foreground">
                Start shortening links in under 30 seconds.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-4 sm:mb-20 mb-12">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-primary/80 p-8 sm:p-12 text-center text-primary-foreground">
          <div className="absolute inset-0 bg-grid-white/10 mask-[linear-gradient(0deg,transparent,white)]" />
          <h2 className="relative text-2xl sm:text-3xl font-bold mb-3">
            Ready to get started?
          </h2>
          <p className="relative text-primary-foreground/80 mb-6 max-w-xl mx-auto">
            Join thousands of marketers who are already saving time and money
            with Shortn.at.
          </p>
          <div className="relative flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-full"
            >
              <Link href="/register">
                Start for free <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
