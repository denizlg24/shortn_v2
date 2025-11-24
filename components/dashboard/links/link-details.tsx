import { IUrl } from "@/models/url/UrlV3";
import { LinkDetailsCard } from "./link-details-card";
import { LinkAdditionsCard } from "./link-additions-card";
import { IQRCode } from "@/models/url/QRCodeV2";
import { LinkTimeAnalytics } from "./link-time-analytics";
import { LinkLocationAnalytics } from "./link-location-analytics";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { LinkSourceData } from "./link-source-data";
import { LinkStackedSourceData } from "./link-stacked-source-data";
import { LinkTimeByDateData } from "./link-time-by-date-data";
import { ClickDataProvider } from "@/utils/ClickDataContext";
import { LinkUtmParams } from "./link-utm-params";
import { LinkUtmStats } from "./link-utm-stats";
import { getClicks } from "@/utils/fetching-functions";
import { getUser } from "@/app/actions/userActions";

export const LinkDetails = async ({
  url,
  qr,
}: {
  url: IUrl;
  qr: IQRCode | undefined;
}) => {
  const { user } = await getUser();
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
          <LinkUtmParams
            currentLink={url}
            unlocked={user.plan.subscription == "pro"}
          />
          <LinkAdditionsCard qrCode={qr} url={url} />
          <LinkTimeAnalytics
            unlocked={
              user.plan.subscription == "plus" ||
              user.plan.subscription == "pro"
            }
            createdAt={url.date}
            initialClicks={clicks}
          />
          <LinkTimeByDateData
            unlocked={
              user.plan.subscription == "plus" ||
              user.plan.subscription == "pro"
            }
            createdAt={url.date}
            initialClicks={clicks}
          />
          <LinkLocationAnalytics
            unlocked={
              user.plan.subscription == "pro"
                ? "all"
                : user.plan.subscription == "plus"
                  ? "location"
                  : "none"
            }
            initialClicks={clicks}
          />
          <div className="w-full grid lg:grid-cols-2 grid-cols-1 gap-4">
            <LinkSourceData
              unlocked={user.plan.subscription == "pro"}
              initialClicks={clicks}
            />
            <LinkStackedSourceData
              unlocked={user.plan.subscription == "pro"}
              createdAt={url.date}
              initialClicks={clicks}
            />
          </div>
          {(url.utmLinks?.length ?? 0) > 0 && (
            <LinkUtmStats
              createdAt={url.date}
              unlocked={user.plan.subscription == "pro"}
              initialClicks={clicks}
            />
          )}
        </ClickDataProvider>
      )}
    </>
  );
};
