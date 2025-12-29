import { Link, redirect } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";

import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyBiosCard } from "./empty-bios-card";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PagesContainer } from "./pages-container";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/polarActions";
import { signOutUser } from "@/app/actions/signOut";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("bioPages.title"),
    description: t("bioPages.description"),
    keywords: t("bioPages.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("bioPages.title"),
      description: t("bioPages.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("bioPages.title"),
      description: t("bioPages.description"),
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    await signOutUser();
    redirect({ href: "/login", locale });
    return;
  }
  const { plan } = await getUserPlan();
  if (plan != "pro") {
    return (
      <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 rounded-md bg-linear-to-tr from-yellow-100 to-yellow-50 text-yellow-700">
              <Star className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg">Pages (Pro)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Create custom bio pages with multiple links and track
                engagement.
              </p>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ul className="list-disc ml-5 text-sm text-muted-foreground">
              <li>
                Build beautiful, customizable landing pages with unlimited links
                for your social media profiles.
              </li>
              <li>
                Track clicks and engagement on each link to understand what
                resonates with your audience.
              </li>
              <li>
                Customize your page with themes, colors, and branding to match
                your style.
              </li>
            </ul>

            <div className="flex flex-col items-center gap-3 pt-2">
              <Button asChild className="w-full">
                <Link href="/dashboard/subscription" className="w-full">
                  Upgrade to Pro
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  await connectDB();
  const query: string = ((await searchParams).query as string) || "";
  const page = parseInt(((await searchParams).page as string) || "1", 10);
  const limit = parseInt(((await searchParams).limit as string) || "10", 10);
  const totalBios = await BioPage.countDocuments({ userId: user.sub });
  const bios = await BioPage.find({
    userId: user.sub,
    ...(query ? { $text: { $search: query.trim() } } : {}),
  });
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
        {totalBios == 0 ? (
          <EmptyBiosCard />
        ) : (
          <PagesContainer
            initialQuery={query}
            currPage={page}
            total={bios.length}
            limit={limit}
            pages={bios.map((bio) => ({
              title: bio.title,
              slug: bio.slug,
              createdAt: bio.createdAt,
              linkCount: bio.links?.length ?? 0,
              image: bio.avatarUrl,
            }))}
          />
        )}
      </div>
    </main>
  );
}
