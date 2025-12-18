import DotGrid from "@/components/DotGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  BookOpen,
  CircleQuestionMark,
  MoveRight,
  ScrollText,
  Search,
} from "lucide-react";
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

      <div className="hover:backdrop-blur-3xl transition-all px-4 sm:my-24 my-16  w-full max-w-4xl mx-auto flex flex-col items-center gap-6 ">
        <h1 className="md:text-7xl sm:text-6xl xs:text-5xl text-4xl font-black">
          How can we help you?
        </h1>
        <h2 className="text-lg text-muted-foreground max-w-xl text-center">
          Search our knowledge base or browse popular topics below
        </h2>
        <div className="w-full relative flex items-center">
          <Input
            placeholder="Search for help articles..."
            className="w-full pl-12 xs:h-12 h-10 rounded-sm bg-muted"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
            <Search className="w-4 h-4" />
          </div>
        </div>
      </div>
      <div className="flex flex-row items-center gap-2 w-full max-w-7xl mx-auto px-4">
        <Separator className="grow flex-1" />
        <p className="shrink-0 xs:text-sm text-xs text-muted-foreground font-medium">
          OR
        </p>
        <Separator className="grow flex-1" />
      </div>
      <div className="sm:my-20 my-12 w-full mx-auto max-w-5xl grid md:grid-cols-4 grid-cols-2 gap-4 items-stretch px-2">
        <a className="group w-full col-span-1 h-full" href="">
          <div className="flex flex-col items-center text-center h-full gap-4 bg-muted p-4 rounded-xl shadow-xs border  group-hover:-translate-y-px group-hover:shadow-2xl transition-all">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <BookOpen className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Documentation
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-auto">
              Complete user guides.
            </p>
          </div>
        </a>
        <a className="group w-full col-span-1 h-full" href="">
          <div className="flex flex-col items-center text-center gap-4 bg-muted h-full p-4 rounded-xl shadow-xs border  group-hover:-translate-y-px group-hover:shadow-2xl transition-all">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <BookOpen className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Video Tutorials
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-auto">
              Step-by-Step video guides.
            </p>
          </div>
        </a>
        <a className="group w-full col-span-1 h-full" href="">
          <div className="flex flex-col items-center text-center gap-4 bg-muted h-full p-4 rounded-xl shadow-xs border  group-hover:-translate-y-px group-hover:shadow-2xl transition-all">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <ScrollText className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">
              Billing
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-auto">
              Plan related questions.
            </p>
          </div>
        </a>
        <a className="group w-full col-span-1 h-full" href="">
          <div className="flex flex-col items-center text-center gap-4 bg-muted h-full p-4 rounded-xl shadow-xs border  group-hover:-translate-y-px group-hover:shadow-2xl transition-all">
            <div className="flex items-center justify-center p-2 rounded-lg bg-muted-foreground/15">
              <CircleQuestionMark className="sm:w-5 sm:h-5 xs:w-4 xs:h-4 w-3.5 h-3.5" />
            </div>
            <h2 className="text-base xs:text-lg sm:text-xl font-bold">FAQ</h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-auto">
              Common Questions.
            </p>
          </div>
        </a>
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
