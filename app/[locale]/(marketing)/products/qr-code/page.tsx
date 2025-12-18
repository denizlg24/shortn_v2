import DotGrid from "@/components/DotGrid";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ChartAreaIcon, LineSquiggle, MoveRight, Palette } from "lucide-react";
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
          Dynamic QR Codes that track
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl">
          Create customizable QR codes with built-in analytics. Update
          destinations anytime without reprinting, and track every scan in
          real-time.
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
            Powerful QR Code features
          </h1>
          <div className="col-span-1 w-full text-center flex flex-col items-center gap-4">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <Palette className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Customizable design
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              Add your logo, customize colors, and match your brand identity
              perfectly.
            </p>
          </div>
          <div className="col-span-1 w-full text-center flex flex-col items-center gap-4">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <LineSquiggle className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Dynamic Updates
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              Change the destination URL anytime without creating a new QR code.
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
              Track every scan with detailed analytics including location and
              device data.
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
          "Shortn's QR code generator has transformed how we engage with our
          customers. The ability to create dynamic QR codes that we can update
          on the fly has been a game-changer for our marketing campaigns. Plus,
          the detailed analytics give us invaluable insights into customer
          behavior, allowing us to tailor our strategies effectively. Highly
          recommended!"
        </p>
        <Separator />
        <p className="sm:text-lg xs:text-base text-xs text-muted-foreground italic my-8 hover:backdrop-blur-3xl ">
          "As a small business owner, Shortn's QR code generator has been an
          essential tool for connecting with my customers. The customization
          options allowed me to brand my QR codes, making them more appealing an
          helping me establish a professional image."
        </p>
        <Separator />
        <p className="sm:text-lg xs:text-base text-xs text-muted-foreground italic my-8 hover:backdrop-blur-3xl ">
          "Using Shortn's QR code generator has significantly enhanced our event
          marketing efforts. The ease of creating and managing dynamic QR codes
          has allowed us to provide attendees with up-to-date information and
          exclusive content. The analytics feature has also been invaluable in
          measuring engagement and planning future events more effectively."
        </p>
      </div>
      <div className="w-full bg-muted px-4 py-12 border-b-2">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto gap-6">
          <h1 className="md:text-4xl sm:text-3xl xs:text-2xl text-xl font-bold">
            Start creating QR codes today
          </h1>
          <h2 className="text-lg text-muted-foreground max-w-xl">
            Join thousands of businesses and individuals using Shortn to create
            dynamic QR codes.
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
