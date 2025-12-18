import DotGrid from "@/components/DotGrid";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ChartAreaIcon, Globe, LockKeyhole, MoveRight } from "lucide-react";
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
          Shorten links, establish an online presence
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl">
          Shorten long links to make them easy to share and remember. Allude
          customers to your brand with personalized short links. Get detailed
          analytics on link performance.
        </h2>
        <Button asChild className="rounded-full w-full max-w-sm" size={"lg"}>
          <Link href={"/register"}>
            Get Started Today <MoveRight />
          </Link>
        </Button>
      </div>
      <div className="w-full bg-muted px-4 py-12 sm:my-20 my-12">
        <div className="w-full mx-auto max-w-7xl grid grid-cols-3 gap-6 gap-y-12">
          <h1 className="sm:text-3xl xs:text-2xl text-lg font-black col-span-full text-center">
            Powerful URL shortening features
          </h1>
          <div className="col-span-1 w-full text-center flex flex-col items-center gap-4">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <Globe className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Custom Back-halves
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              Choose a custom back-half for your links to reinforce your brand
              and make URLs memorable and easy to share.
            </p>
          </div>
          <div className="col-span-1 w-full text-center flex flex-col items-center gap-4">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <LockKeyhole className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Password Protection
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              Secure your shortened links with passwords to restrict access to
              authorized users only.
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
              Track link performance with in-depth analytics including click
              counts, geographic data, and referrer information.
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
          "Using Shortn's URL shortener has transformed our marketing efforts.
          The ability to create branded, trackable links has not only boosted
          our click-through rates but also provided invaluable insights into our
          audience's behavior. It's an essential tool for any business looking
          to enhance their online presence."
        </p>
        <Separator />
        <p className="sm:text-lg xs:text-base text-xs text-muted-foreground italic my-8 hover:backdrop-blur-3xl ">
          "Shortn's URL shortening service is a game-changer for our social
          media campaigns. The ease of creating custom short links that reflect
          our brand has significantly increased engagement and shareability.
          Plus, the detailed analytics allow us to fine-tune our strategies
          based on real data. We can't imagine running our campaigns without
          it!"
        </p>
        <Separator />
        <p className="sm:text-lg xs:text-base text-xs text-muted-foreground italic my-8 hover:backdrop-blur-3xl ">
          "As a University teacher, I've found Shortn's URL shortener to be an
          invaluable tool for sharing resources with my students. The custom
          links are easy to remember and share, making it simple for students to
          access course materials and stay organized. The analytics feature also
          helps me understand which resources are most utilized, allowing me to
          tailor my teaching approach effectively. The password protection
          feature ensures that only my students can access the links,
          maintaining the integrity of the course content."
        </p>
      </div>
      <div className="w-full bg-muted px-4 py-12 border-b-2">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto gap-6">
          <h1 className="md:text-4xl sm:text-3xl xs:text-2xl text-xl font-bold">
            Start creating short links today
          </h1>
          <h2 className="text-lg text-muted-foreground max-w-xl">
            Join thousands of businesses and individuals using Shortn for better
            link management.
          </h2>
          <Button asChild className="rounded-full w-full max-w-sm" size={"lg"}>
            <Link href={"/register"}>
              Get Started Today <MoveRight />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
