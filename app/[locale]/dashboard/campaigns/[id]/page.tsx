import { getUser } from "@/app/actions/userActions";
import { LinkContainer } from "@/components/dashboard/links/link-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { Campaigns } from "@/models/url/Campaigns";
import { IUrl } from "@/models/url/UrlV3";
import { Star } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

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
  const { success, user } = await getUser();
  if (!success || !user) {
    notFound();
  }
  if (user.plan.subscription != "pro") {
    return (
      <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 rounded-md bg-gradient-to-tr from-yellow-100 to-yellow-50 text-yellow-700">
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
  const campaign = await Campaigns.findOne({ sub: user.sub, _id: id })
    .populate<IUrl>({ path: "links", model: "UrlV3" })
    .lean();
  if (!campaign) {
    notFound();
  }
  const filters = {
    page: parseInt(searchP.page || "1", 10),
    limit: parseInt(searchP.limit || "10", 3),
  };
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="col-span-full w-full flex flex-col gap-4">
          <div className="lg:p-4 sm:p-3 p-2 rounded bg-background shadow w-full flex flex-col gap-4">
            <div className="w-full flex flex-row items-center justify-between gap-2">
              <div className="w-full max-w-[70%] truncate flex flex-col  justify-start gap-1">
                <h1 className="font-bold lg:text-xl md:text-lg text-base hover:underline underline-offset-4 truncate">
                  {campaign.title}
                </h1>
                <p className="text-xs font-semibold text-muted-foreground underline">
                  {campaign.links.length} links
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-start">
              <h2 className="font-bold text-base">Grouped Links</h2>
              <div className="bg-muted w-full p-2">
                <LinkContainer
                  links={(
                    campaign.links.slice(
                      (filters.page - 1) * filters.limit,
                      (filters.page - 1) * filters.limit + filters.limit,
                    ) as IUrl[]
                  ).map((link) => ({
                    ...link,
                    _id: (link._id as string).toString(),
                    tags: link.tags?.map((tag) => ({
                      ...tag,
                      _id: (tag._id as string).toString(),
                    })),
                    utmLinks: link.utmLinks?.map((link) => ({
                      ...link,
                      _id: (link._id as string).toString(),
                      ...(link.campaign
                        ? {
                            campaign: {
                              title: link.campaign.title,
                              _id: (link.campaign._id as string).toString(),
                            },
                          }
                        : {}),
                    })),
                  }))}
                  total={campaign.links.length}
                  limit={filters.limit}
                  page={filters.page}
                  tags={[]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
