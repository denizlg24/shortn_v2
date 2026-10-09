import { redirect, Link } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { Campaigns } from "@/models/url/Campaigns";
import UrlV3 from "@/models/url/UrlV3";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/polarActions";
import { CampaignLinkUtmEditor } from "@/components/dashboard/campaigns/campaign-link-utm-editor";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default async function CampaignLinkPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; urlCode: string }>;
}) {
  const { locale, id, urlCode } = await params;
  setRequestLocale(locale);

  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    redirect({ href: "/dashboard/logout", locale: locale });
    return;
  }

  const { plan } = await getUserPlan();
  if (plan !== "pro" && plan !== "plus") {
    redirect({ href: "/dashboard/subscription", locale: locale });
    return;
  }

  await connectDB();

  const campaign = await Campaigns.findOne({ sub: user.sub, _id: id }).lean();
  if (!campaign) {
    notFound();
  }

  const link = await UrlV3.findOne({ sub: user.sub, urlCode }).lean();
  if (!link) {
    notFound();
  }

  const isLinkInCampaign = campaign.links.some(
    (linkId) => linkId.toString() === link._id.toString(),
  );
  if (!isLinkInCampaign) {
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

  const serializedUtmLinks = (link.utmLinks || []).map((utm) => ({
    source: utm.source,
    medium: utm.medium,
    campaign: utm.campaign
      ? {
          _id: utm.campaign._id?.toString() || "",
          title: utm.campaign.title,
        }
      : undefined,
    term: utm.term,
    content: utm.content,
  }));

  return (
    <main className="flex flex-col items-center w-full mx-auto bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <div className="space-y-4">
          <Button variant="link" asChild className="p-0! h-auto">
            <Link
              href={`/dashboard/campaigns/${id}`}
              className="font-semibold text-sm text-muted-foreground hover:text-foreground p-0!"
            >
              <ChevronLeft />
              Back to campaign
            </Link>
          </Button>

          <div>
            <h1 className="text-xl font-bold">Manage Link UTM</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-muted-foreground">
                Configure UTM parameters for this link
              </span>
            </div>
          </div>
        </div>

        <CampaignLinkUtmEditor
          urlCode={urlCode}
          linkTitle={link.title || urlCode}
          longUrl={link.longUrl}
          campaignId={id}
          campaignTitle={campaign.title}
          utmDefaults={serializedUtmDefaults}
          initialUtmLinks={serializedUtmLinks}
        />
      </div>
    </main>
  );
}
