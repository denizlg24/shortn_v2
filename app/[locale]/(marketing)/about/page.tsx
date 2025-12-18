import DotGrid from "@/components/DotGrid";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Globe, MoveRight, Target } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

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
        <h1 className="md:text-7xl sm:text-6xl xs:text-5xl text-4xl font-black">
          Brand management affordable for everyone
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl">
          We believe powerful tools shouldn't come with enterprise price tags.
          That's why we built shortn.at.
        </h2>
        <Button asChild className="rounded-full w-full max-w-sm" size={"lg"}>
          <Link href={"/register"}>
            Get Started Today <MoveRight />
          </Link>
        </Button>
      </div>
      <div className="flex md:flex-row flex-col md:items-end items-center gap-6 justify-center sm:my-20 my-12 mx-auto max-w-7xl px-4 w-full">
        <div className="flex flex-col gap-4 md:items-start md:text-left text-center items-center md:w-[65%] shrink-0 hover:backdrop-blur-3xl">
          <div className="rounded-full py-1.5 px-4 bg-muted border shadow flex items-center justify-center gap-2 text-muted-foreground">
            <Target className="w-4 h-4" />
            <span className="text-sm font-medium">Our mission</span>
          </div>
          <h1 className="md:text-4xl sm:text-3xl xs:text-2xl text-xl font-bold">
            Democratizing professional link management
          </h1>
          <p className="xs:text-base text-sm text-muted-foreground">
            We started shortn.at because we were frustrated with the high costs
            of existing link management platforms. Small businesses, creators,
            and startups were paying hundreds of dollars per month for basic
            features.
          </p>
          <p className="xs:text-base text-sm text-muted-foreground">
            We knew there was a better way. By building efficient infrastructure
            and focusing on what matters, we created a platform that offers
            enterprise features at 95% lower prices without compromising on
            quality or reliability.
          </p>
        </div>
        <div className="md:w-auto w-full bg-muted rounded-xl shadow-sm border p-3 flex flex-col gap-4">
          <div className="flex flex-row items-center gap-2 w-full">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15 shrink-0">
              <Globe className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col items-start gap-1.55">
              <h2 className="text-sm xs:text-base font-semibold">
                Fast & Reliable
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Global CDN ensures lightning-fast redirects worldwide
              </p>
            </div>
          </div>
          <div className="flex flex-row items-center gap-2 w-full">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15 shrink-0">
              <Globe className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col items-start gap-1.55">
              <h2 className="text-sm xs:text-base font-semibold">
                Customer First
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Built with feedback from hundreds of users
              </p>
            </div>
          </div>
          <div className="flex flex-row items-center gap-2 w-full">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15 shrink-0">
              <Globe className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col items-start gap-1.55">
              <h2 className="text-sm xs:text-base font-semibold">
                Quality Focused
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                99.9% uptime SLA with enterprise-grade infrastructure
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full bg-muted border px-2 py-6 sm:my-20 my-12 ">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-3 text-center">
          <div className="col-span-full w-full mb-12 mt-6">
            <h1 className="md:text-5xl sm:text-4xl xs:text-3xl text-2xl font-black">
              Growing fast, staying focused
            </h1>
          </div>
          <div className="flex flex-col gap-2 col-span-1 w-full items-center">
            <span className="md:text-5xl sm:text-4xl xs:text-3xl text-2xl font-bold">
              2023
            </span>
            <span className="sm:text-base text-xs text-muted-foreground">
              Founded
            </span>
          </div>
          <div className="flex flex-col gap-2 col-span-1 w-full items-center">
            <span className="md:text-5xl sm:text-4xl xs:text-3xl text-2xl font-bold">
              15K+
            </span>
            <span className="sm:text-base text-xs text-muted-foreground">
              Links served
            </span>
          </div>
          <div className="flex flex-col gap-2 col-span-1 w-full items-center">
            <span className="md:text-5xl sm:text-4xl xs:text-3xl text-2xl font-bold">
              35+
            </span>
            <span className="sm:text-base text-xs text-muted-foreground">
              Countries reached
            </span>
          </div>
        </div>
      </div>
      <div className="hover:backdrop-blur-3xl transition-all sm:mb-20 mb-12 mx-auto max-w-4xl text-center w-full px-4 flex flex-col items-center gap-6 z-10">
        <h1 className="md:text-5xl sm:text-4xl xs:text-3xl text-2xl font-black hover:backdrop-blur-3xl ">
          Built by a passionate team
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl">
          We're passionate about creating tools that empower individuals and
          businesses to succeed online. Your support means the world to us.
        </h2>
      </div>
    </main>
  );
}
