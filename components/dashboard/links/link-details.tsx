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

export const LinkDetails = ({
  urlCode,
  url,
  qr,
}: {
  urlCode: string;
  url: IUrl;
  qr: IQRCode | undefined;
}) => {
  const session = useUser();

  return (
    <>
      {url && session.user && (
        <>
          <Button variant={"link"} asChild>
            <Link className="font-semibold mr-auto" href={`/dashboard/links`}>
              <ChevronLeft />
              Back to list
            </Link>
          </Button>
          <LinkDetailsCard currentLink={url} />
          <LinkAdditionsCard qrCode={qr} url={url} />
          <LinkTimeAnalytics
            unlocked={session.user.plan.subscription != "free"}
            linkData={url}
          />
          <LinkLocationAnalytics
            unlocked={
              session.user.plan.subscription == "plus" ||
              session.user.plan.subscription == "pro"
            }
            linkData={url}
          />
        </>
      )}
    </>
  );
};
