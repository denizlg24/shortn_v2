import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { Campaigns } from "@/models/url/Campaigns";
import { Star } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/polarActions";
import { CampaignStatsDashboard } from "@/components/dashboard/campaigns/campaign-stats-dashboard";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    redirect({ href: "/dashboard/logout", locale: locale });
    return;
  }
  const { plan } = await getUserPlan();
  if (plan !== "pro" && plan !== "plus") {
    return (
      <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 rounded-md bg-linear-to-tr from-yellow-100 to-yellow-50 text-yellow-700">
              <Star className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg">Campaigns (Pro)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Group links and get aggregated campaign analytics.
              </p>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ul className="list-disc ml-5 text-sm text-muted-foreground">
              <li>
                Create, track, and manage marketing campaigns with real-time
                analytics for clicks and conversions.
              </li>
              <li>
                Segment performance by source, medium, and campaign to identify
                top-performing channels.
              </li>
              <li>
                Export campaign data for reporting and share insights with your
                team.
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

  const campaign = await Campaigns.findOne({ sub: user.sub, _id: id }).lean();

  if (!campaign) {
    notFound();
  }

  const serializedUtmDefaults = campaign.utmDefaults
    ? {
        sources: campaign.utmDefaults.sources || [],
        mediums: campaign.utmDefaults.mediums || [],
        terms: campaign.utmDefaults.terms || [],
        contents: campaign.utmDefaults.contents || [],
      }
    : undefined;

  return (
    <main className="flex flex-col items-center w-full mx-auto bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto">
        <CampaignStatsDashboard
          campaignId={id}
          campaignTitle={campaign.title}
          campaignDescription={campaign.description}
          campaignUtmDefaults={serializedUtmDefaults}
          linksCount={campaign.links.length}
          createdAt={campaign.createdAt.toISOString()}
        />
      </div>
    </main>
  );
}
