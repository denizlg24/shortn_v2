import DotGrid from "@/components/DotGrid";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Globe, MoveRight, Target } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { use } from "react";
import polarLogo from "@/public/polar-sh.webp";
import shadcnLogo from "@/public/shadcn-ui.png";
import headshot from "@/public/headshot-square.png";
import claudeLogo from "@/public/claude-logo.svg";
export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("about.title"),
    description: t("about.description"),
    keywords: t("about.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("about.title"),
      description: t("about.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("about.title"),
      description: t("about.description"),
    },
  };
}

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
            enterprise features at 85% lower prices without compromising on
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
      <div className="w-full bg-muted/50 border-y px-2 py-6 sm:my-20 my-12 ">
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

      <div className="w-full max-w-5xl mx-auto px-4 sm:mb-20 mb-12">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="group bg-background border rounded-xl p-6 text-center hover:shadow-lg hover:border-primary/50 transition-all duration-300">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-linear-to-br from-primary to-primary/60 flex items-center justify-center">
              <Image
                src={headshot}
                alt="Deniz Gunes"
                className="w-full h-auto aspect-square rounded-full object-cover"
              />
            </div>
            <h3 className="font-semibold text-lg mb-1">Deniz</h3>
            <p className="text-sm text-primary font-medium mb-2">
              Founder & Developer
            </p>
            <p className="text-sm text-muted-foreground">
              Building the future of link management, one feature at a time.
            </p>
          </div>

          <div className="group bg-background border rounded-xl p-6 text-center hover:shadow-lg hover:border-primary/50 transition-all duration-300">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-linear-to-br from-gray-800 to-gray-600 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-1">GitHub Copilot</h3>
            <p className="text-sm text-primary font-medium mb-2">
              AI Pair Programmer
            </p>
            <p className="text-sm text-muted-foreground">
              Accelerating development with intelligent code suggestions and
              completions.
            </p>
          </div>

          <div className="group bg-background border rounded-xl p-6 text-center hover:shadow-lg hover:border-primary/50 transition-all duration-300">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Image
                src={claudeLogo}
                alt="ClaudeCode"
                className="h-auto aspect-square object-cover m-auto w-12"
              />
            </div>
            <h3 className="font-semibold text-lg mb-1">Claude</h3>
            <p className="text-sm text-primary font-medium mb-2">
              AI Assistant
            </p>
            <p className="text-sm text-muted-foreground">
              Helping architect solutions and solve complex problems with
              thoughtful analysis.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full border-t py-10 sm:mb-8 mb-4">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-center text-xs text-muted-foreground mb-6 uppercase tracking-wider">
            Built with
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-60 hover:opacity-80 transition-opacity">
            <div className="flex items-center gap-2 text-muted-foreground">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 1-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.86 8.292 8.209 9.695.779.25 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.05-.106.006-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.54-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.572 0zm4.069 7.217c.347 0 .408.005.486.047a.473.473 0 0 1 .237.277c.018.06.023 1.365.018 4.304l-.006 4.218-.744-1.14-.746-1.14v-3.066c0-1.982.01-3.097.023-3.15a.478.478 0 0 1 .233-.296c.096-.05.13-.054.5-.054z" />
              </svg>
              <span className="text-xs font-medium">Next.js</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 22.525H0l12-21.05 12 21.05z" />
              </svg>
              <span className="text-xs font-medium">Vercel</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0111.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 003.639-8.464c.01-.814-.103-1.662-.197-2.218zm-5.336 8.195s0-8.291.275-8.29c.213 0 .49 10.695.49 10.695-.381-.045-.765-1.76-.765-2.405z" />
              </svg>
              <span className="text-xs font-medium">MongoDB</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Image
                alt="Polar.sh logo"
                src={polarLogo}
                className="object-cover w-4 h-4 opacity-50"
              />
              <span className="text-xs font-medium">Polar.sh</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
              </svg>
              <span className="text-xs font-medium">Better Auth</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Image
                alt="Shadcn.ui logo"
                src={shadcnLogo}
                className="object-cover w-4 h-4 opacity-50"
              />
              <span className="text-xs font-medium">shadcn/ui</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
