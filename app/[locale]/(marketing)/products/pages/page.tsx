import DotGrid from "@/components/DotGrid";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ChartAreaIcon, MoveRight, Palette, Share2 } from "lucide-react";
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
          One link for all your content
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl">
          Create a beautiful landing page for your Instagram, TikTok, and social
          media bio. Share all your important links in one place with custom
          branding.
        </h2>
        <Button asChild className="rounded-full w-full max-w-sm" size={"lg"}>
          <Link href={"/register"}>
            Get Started Today <MoveRight />
          </Link>
        </Button>
      </div>
      <div className="w-full bg-muted/50 border-y px-4 py-12 sm:my-20 my-12">
        <div className="w-full mx-auto max-w-7xl grid grid-cols-3 gap-6 gap-y-12">
          <h1 className="sm:text-3xl xs:text-2xl text-lg font-black col-span-full text-center">
            Powerful Shortn page features
          </h1>
          <div className="col-span-1 w-full text-center flex flex-col items-center gap-4">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <Palette className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Full Customization
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              Choose themes, colors, fonts, and layouts that match your personal
              brand.
            </p>
          </div>
          <div className="col-span-1 w-full text-center flex flex-col items-center gap-4">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <Share2 className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Social Integration
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              Display your social media icons and connect all your profiles in
              one place.
            </p>
          </div>
          <div className="col-span-1 w-full text-center flex flex-col items-center gap-4">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <ChartAreaIcon className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Detailed Analytics
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              Group your links and track clicks to see which content resonates
              most with your audience.
            </p>
          </div>
        </div>
      </div>
      <div className="transition-all sm:mb-20 mb-12 mx-auto max-w-4xl text-center w-full px-4 flex flex-col items-center gap-6 z-10">
        <h1 className="md:text-5xl sm:text-4xl xs:text-3xl text-2xl font-black hover:backdrop-blur-3xl ">
          Perfect for every use case
        </h1>
        <h2 className="md:text-3xl sm:text-2xl xs:text-xl text-lg font-bold hover:backdrop-blur-3xl ">
          What our users are saying
        </h2>
        <p className="sm:text-lg xs:text-base text-xs text-muted-foreground italic my-8 hover:backdrop-blur-3xl ">
          "Shortn's Pages feature has revolutionized how I share my content
          online. As a content creator, having a single, customizable landing
          page for all my links has made it incredibly easy for my audience to
          find and engage with my work. The analytics provided help me
          understand my audience better and tailor my content accordingly."
        </p>
        <Separator />
        <p className="sm:text-lg xs:text-base text-xs text-muted-foreground italic my-8 hover:backdrop-blur-3xl ">
          "As a small business owner, Shortn's Pages feature has been a
          game-changer for my online presence. It allows me to create a
          professional-looking landing page that showcases all my products and
          services in one place. The customization options let me align the page
          with my brand identity, and the analytics help me track visitor
          engagement effectively."
        </p>
        <Separator />
        <p className="sm:text-lg xs:text-base text-xs text-muted-foreground italic my-8 hover:backdrop-blur-3xl ">
          "Using Shortn's Pages feature has significantly enhanced my social
          media marketing efforts. The ability to create a single landing page
          with all my important links has made it easier for my followers to
          keep up with my latest content."
        </p>
      </div>
      <div className="w-full max-w-4xl mx-auto px-4 sm:mb-20 mb-12">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-primary/80 p-8 sm:p-12 text-center text-primary-foreground">
          <div className="absolute inset-0 bg-grid-white/10 mask-[linear-gradient(0deg,transparent,white)]" />
          <h1 className="relative md:text-4xl sm:text-3xl xs:text-2xl text-xl font-bold mb-3">
            Start creating Pages today
          </h1>
          <h2 className="relative text-primary-foreground/80 mb-6 max-w-xl mx-auto">
            Join thousands of businesses and individuals using Shortn to create
            dynamic Pages.
          </h2>
          <Button
            asChild
            variant="secondary"
            className="relative rounded-full w-full max-w-sm"
            size={"lg"}
          >
            <Link href={"/register"}>
              Get Started Today <MoveRight />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
