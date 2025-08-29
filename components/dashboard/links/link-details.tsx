"use client";

import { getShortn } from "@/app/actions/linkActions";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { IUrl } from "@/models/url/UrlV3";
import { useUser } from "@/utils/UserContext";
import { useEffect, useState } from "react";
import { LinkDetailsCard } from "./link-details-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { LinkAdditionsCard } from "./link-additions-card";
import { IQRCode } from "@/models/url/QRCodeV2";
import { getQRCode } from "@/app/actions/qrCodeActions";
import { LinkTimeAnalytics } from "./link-time-analytics";
import { LinkLocationAnalytics } from "./link-location-analytics";

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
