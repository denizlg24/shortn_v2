import DotGrid from "@/components/DotGrid";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { RotatingSubtitle } from "./_components/rotating-subtitle";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
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
    <main className="flex flex-col items-center w-full mx-auto relative min-h-screen">
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

      <div className="hover:backdrop-blur-3xl transition-all sm:mt-24 mt-16 mx-auto max-w-xl text-center w-full px-4 flex flex-col items-center gap-6 z-10">
        <h1 className="md:text-7xl sm:text-6xl xs:text-5xl text-4xl font-black">
          <span className="md:text-5xl sm:text-4xl xs:text-3xl text-2xl font-semibold ">
            Welcome to
          </span>{" "}
          <span className="underline">SHORTN.at</span>
        </h1>
        <RotatingSubtitle
          texts={[
            "Link shortener",
            "QR Code creator",
            "Marketing platform",
            "Analytics dashboard",
            "Personal page",
          ]}
        />
        <div className="flex sm:flex-row flex-col gap-2 items-center justify-center w-full">
          <Button asChild size={"lg"} className="rounded-full w-full sm:flex-1">
            <Link href={"/register"}>
              Get started for <span className="-ml-1 font-bold">free</span>
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
        <Button asChild variant={"link"} className="sm:mt-0 -mt-4">
          <Link href={"/products/url-shortener"}>
            Learn more <ExternalLink />
          </Link>
        </Button>
      </div>

      <div className="hover:backdrop-blur-3xl sm:mt-20 mt:12 mx-auto max-w-5xl flex flex-col gap-6 px-4 items-center">
        <h1 className="wrap-break-word md:text-3xl xs:text-2xl font-medium text-xl text-center">
          <GradientText
            colors={["#131954", " #4079ff", " #131954", " #4079ff", "#131954"]}
            animationSpeed={8}
            showBorder={false}
            className="inline-flex rounded-none! wrap-break-word"
          >
            Supercharge
          </GradientText>{" "}
          your marketing strategy with{" "}
          <GradientText
            colors={["#131954", " #4079ff", " #131954", " #4079ff", "#131954"]}
            animationSpeed={8}
            showBorder={false}
            className="inline-flex rounded-none! wrap-break-word"
          >
            Shortn.at's
          </GradientText>{" "}
          all-in-one platform designed to{" "}
          <GradientText
            colors={["#131954", " #4079ff", " #131954", " #4079ff", "#131954"]}
            animationSpeed={8}
            showBorder={false}
            className="inline-flex rounded-none! wrap-break-word"
          >
            boost engagement
          </GradientText>{" "}
          and{" "}
          <GradientText
            colors={["#131954", " #4079ff", " #131954", " #4079ff", "#131954"]}
            animationSpeed={8}
            showBorder={false}
            className="inline-flex rounded-none! wrap-break-word"
          >
            drive conversions
          </GradientText>{" "}
          .
        </h1>
      </div>
    </main>
  );
}
