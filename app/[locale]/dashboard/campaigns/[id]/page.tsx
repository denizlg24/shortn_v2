import { CampaignLinkContainer } from "@/components/dashboard/campaigns/campaign-link-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { Campaigns } from "@/models/url/Campaigns";
import { IUrl } from "@/models/url/UrlV3";
import { Plus, Star } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DeleteCampaignButton } from "./delete-campaign-button";
import { DownloadButtonCSV } from "@/components/dashboard/links/download-csv-button";
import Clicks from "@/models/url/Click";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/polarActions";
import { AddLinkToCampaignDialog } from "@/components/dashboard/campaigns/add-link-to-campaign-dialog";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale, id } = await params;
  const searchP = await searchParams;
  setRequestLocale(locale);
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    redirect({ href: "/dashboard/logout", locale: locale });
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
  const filters = {
    page: parseInt(searchP.page || "1", 10),
    limit: parseInt(searchP.limit || "10", 10),
  };
  const skip = (filters.page - 1) * filters.limit;

  const campaign = await Campaigns.findOne({ sub: user.sub, _id: id }).lean();

  if (!campaign) {
    notFound();
  }

  const totalLinks = campaign.links.length;

  const populatedCampaign =
    totalLinks > 0
      ? await Campaigns.findOne({ sub: user.sub, _id: id })
          .populate({
            path: "links",
            options: { limit: filters.limit, skip },
          })
          .lean()
      : undefined;

  const links = (populatedCampaign?.links || []) as IUrl[];

  const serializedLinks = links.map((link) => ({
    ...link,
    _id: (link._id as string).toString(),
    date: link.date,
    tags: link.tags?.map((tag) => ({
      ...tag,
      _id: tag._id?.toString(),
    })),
  }));

  const clicks = await Clicks.find({
    urlCode: { $in: links.map((link) => link.urlCode) },
    "queryParams.utm_campaign": { $exists: true, $eq: campaign.title },
  })
    .select("-_id -__v -sub -type -ip -queryParams")
    .lean();

  const clicksMap: Record<string, number> = {};
  for (const click of clicks) {
    const code = click.urlCode as string;
    clicksMap[code] = (clicksMap[code] || 0) + 1;
  }

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="col-span-full w-full flex flex-col gap-4">
          <div className="lg:p-4 sm:p-3 p-2 rounded bg-background shadow w-full flex flex-col gap-4">
            <div className="w-full flex xs:flex-row flex-col items-center xs:justify-between gap-2">
              <div className="w-full xs:max-w-[70%] max-w-full truncate flex xs:flex-col flex-row xs:items-start items-center xs:justify-start justify-between gap-1">
                <h1 className="font-bold lg:text-xl md:text-lg text-base hover:underline underline-offset-4 truncate">
                  {campaign.title}
                </h1>
                <p className="text-xs font-semibold text-muted-foreground underline">
                  {totalLinks} links
                </p>
              </div>
              <DeleteCampaignButton
                title={campaign.title ?? ""}
                className="xs:w-fit! w-full"
              />
            </div>
            <div className="flex flex-col gap-2 items-start">
              <div className="w-full flex xs:flex-row flex-col gap-2 xs:items-center xs:justify-between items-start border-b pb-2">
                <div className="w-full flex flex-row items-center gap-2 justify-between">
                  <h2 className="font-bold text-base">Grouped Links</h2>
                  <AddLinkToCampaignDialog
                    campaignTitle={campaign.title ?? ""}
                    trigger={
                      <Button variant={"outline"} size={"icon"}>
                        <Plus />
                      </Button>
                    }
                  />
                </div>

                {clicks.length > 0 && (
                  <DownloadButtonCSV
                    className="xs:w-fit! w-full"
                    filename={`${campaign.title}-clicks.csv`}
                    data={clicks}
                    title={`Export ${clicks.length} clicks to CSV`}
                  />
                )}
              </div>

              <CampaignLinkContainer
                links={serializedLinks.map((link) => ({
                  ...link,
                  utmLinks: [],
                }))}
                total={totalLinks}
                limit={filters.limit}
                clicksMap={clicksMap}
                campaignTitle={campaign.title ?? ""}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
