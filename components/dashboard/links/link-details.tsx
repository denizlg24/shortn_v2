"use client";
import { IUrl } from "@/models/url/UrlV3";
import { useUser } from "@/utils/UserContext";
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

export const LinkDetails = ({
  url,
  qr,
}: {
  url: IUrl;
  qr: IQRCode | undefined;
}) => {
  const session = useUser();

  return (
    <>
      {url && session.user && (
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
            unlocked={session.user.plan.subscription == "pro"}
          />
          <LinkAdditionsCard qrCode={qr} url={url} />
          <LinkTimeAnalytics
            unlocked={
              session.user.plan.subscription == "plus" ||
              session.user.plan.subscription == "pro"
            }
            createdAt={url.date}
          />
          <LinkTimeByDateData
            unlocked={
              session.user.plan.subscription == "plus" ||
              session.user.plan.subscription == "pro"
            }
            createdAt={url.date}
          />
          <LinkLocationAnalytics
            unlocked={
              session.user.plan.subscription == "pro"
                ? "all"
                : session.user.plan.subscription == "plus"
                  ? "location"
                  : "none"
            }
          />
          <div className="w-full grid lg:grid-cols-2 grid-cols-1 gap-4">
            <LinkSourceData
              unlocked={session.user.plan.subscription == "pro"}
            />
            <LinkStackedSourceData
              unlocked={session.user.plan.subscription == "pro"}
              createdAt={url.date}
            />
          </div>
        </ClickDataProvider>
      )}
    </>
  );
};
