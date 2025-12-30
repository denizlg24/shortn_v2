import { IUrl } from "@/models/url/UrlV3";
import { LinkDetailsCard } from "./link-details-card";
import { LinkAdditionsCard } from "./link-additions-card";
import { IQRCode } from "@/models/url/QRCodeV2";
import { LinkTimeAnalytics } from "./link-time-analytics";
import { LinkLocationAnalytics } from "./link-location-analytics";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { LinkSourceData } from "./link-source-data";
import { LinkStackedSourceData } from "./link-stacked-source-data";
import { LinkTimeByDateData } from "./link-time-by-date-data";
import { ClickDataProvider } from "@/utils/ClickDataContext";
import { LinkUtmParams } from "./link-utm-params";
import { LinkUtmStats } from "./link-utm-stats";
import { getClicks } from "@/utils/fetching-functions";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/polarActions";
import { SubscriptionsType } from "@/utils/plan-utils";

export const LinkDetails = async ({
  url,
  qr,
  locale,
}: {
  url: IUrl;
  qr: IQRCode | undefined;
  locale: string;
}) => {
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    redirect({ href: "/dashboard/logout", locale: locale });
    return;
  }
  const { plan } = await getUserPlan();
  const clicks = await getClicks(url.urlCode, undefined, undefined);
  return (
    <>
      {url && user && (
        <ClickDataProvider urlCode={url.urlCode}>
          <Button variant={"link"} asChild>
            <Link className="font-semibold mr-auto" href={`/dashboard/links`}>
              <ChevronLeft />
              Back to list
            </Link>
          </Button>
          <LinkDetailsCard currentLink={url} />
          <LinkUtmParams currentLink={url} unlocked={plan == "pro"} />
          <LinkAdditionsCard
            qrCode={qr}
            url={url}
            subscription={plan as SubscriptionsType}
          />
          <LinkTimeAnalytics
            unlocked={plan == "plus" || plan == "pro"}
            createdAt={url.date}
            initialClicks={clicks}
          />
          <LinkTimeByDateData
            unlocked={plan == "plus" || plan == "pro"}
            createdAt={url.date}
            initialClicks={clicks}
          />
          <LinkLocationAnalytics
            unlocked={
              plan == "pro" ? "all" : plan == "plus" ? "location" : "none"
            }
            initialClicks={clicks}
          />
          <div className="w-full grid lg:grid-cols-2 grid-cols-1 gap-4">
            <LinkSourceData unlocked={plan == "pro"} initialClicks={clicks} />
            <LinkStackedSourceData
              unlocked={plan == "pro"}
              createdAt={url.date}
              initialClicks={clicks}
            />
          </div>
          {(url.utmLinks?.length ?? 0) > 0 && (
            <LinkUtmStats
              createdAt={url.date}
              unlocked={plan == "pro"}
              initialClicks={clicks}
            />
          )}
        </ClickDataProvider>
      )}
    </>
  );
};
