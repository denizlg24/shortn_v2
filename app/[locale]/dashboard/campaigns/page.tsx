import { getUser } from "@/app/actions/userActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { Campaigns } from "@/models/url/Campaigns";
import { LinkIcon, Rocket, Star } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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
  const campaigns = await Campaigns.find({ sub: user.sub }).lean();
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        {campaigns.length > 0 && (
          <h1 className="col-span-full lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
            Your Campaigns
          </h1>
        )}
        {campaigns.length == 0 && (
          <Card className="w-full max-w-3xl col-span-full mx-auto">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 rounded-md bg-gradient-to-tr from-green-100 to-green-50 text-green-700">
                <Rocket className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg">Your Campaigns</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Start tracking campaigns by adding UTM tags to your links.
                </p>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4 text-left">
              <p className="text-muted-foreground text-sm">
                You haven&apos;t created any campaigns yet.
                <br /> To get started, add a{" "}
                <span className="font-medium text-foreground">
                  UTM campaign
                </span>{" "}
                to one of your Shortn&apos;s on the{" "}
                <Link
                  href="/dashboard/links"
                  className="text-primary hover:underline font-medium"
                >
                  Links page
                </Link>
                .
              </p>

              <div className="flex justify-center pt-2 w-full">
                <Button className="w-full" asChild>
                  <Link href="/dashboard/links">Go to your Shortn&apos;s</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {campaigns.length > 0 && (
          <div className="col-span-full w-full flex flex-col gap-4">
            {campaigns.map((campaign) => {
              return (
                <div
                  key={campaign._id.toString()}
                  className="lg:p-4 sm:p-3 p-2 rounded bg-background shadow w-full flex flex-col gap-0"
                >
                  <div className="w-full flex xs:flex-row flex-col items-center justify-between gap-2">
                    <div className="w-full xs:max-w-[70%] truncate flex xs:flex-col flex-row max-w-full xs:justify-start justify-between gap-1">
                      <Link
                        href={`/dashboard/campaigns/${(campaign._id as string).toString()}`}
                        className="font-bold lg:text-xl md:text-lg text-base hover:underline underline-offset-4 truncate"
                      >
                        {campaign.title}
                      </Link>
                      <p className="text-xs font-semibold text-muted-foreground underline">
                        {campaign.links.length} links
                      </p>
                    </div>

                    <Button
                      variant={"secondary"}
                      asChild
                      className="xs:max-w-fit! max-w-full! w-full"
                    >
                      <Link
                        href={`/dashboard/campaigns/${(campaign._id as string).toString()}`}
                      >
                        View Links <LinkIcon />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
