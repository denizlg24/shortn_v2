import DotGrid from "@/components/DotGrid";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { RotatingSubtitle } from "./_components/rotating-subtitle";
import { Button } from "@/components/ui/button";
import { Check, MoveRight, Zap } from "lucide-react";
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
      <div className="w-full bg-muted border px-2 py-6 sm:my-20 my-12 ">
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
    </main>
  );
}
