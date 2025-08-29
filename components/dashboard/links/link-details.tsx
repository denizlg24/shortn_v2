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

export const LinkDetails = ({ urlCode }: { urlCode: string }) => {
  const [loading, setLoading] = useState(true);
  const session = useUser();
  const [url, setUrl] = useState<IUrl | undefined>(undefined);
  const [qrCode, setQRCode] = useState<IQRCode | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);

  const getUrlWrapper = async (code: string) => {
    try {
      const { success, url } = await getShortn(code);
      if (success && url) {
        setUrl(url);
        if (url.qrCodeId) {
          const { success, qr } = await getQRCode(url.qrCodeId);
          if (success && qr) {
            setQRCode(qr);
          }
        }
        setLoading(false);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      setNotFound(true);
    }
  };

  useEffect(() => {
    if (!session) {
      return;
    }
    if (!session.user) {
      return;
    }
    if (!urlCode) {
      setNotFound(true);
    }
    getUrlWrapper(urlCode);
  }, [urlCode, session.user]);

  return (
    <>
      <Button variant={"link"} asChild>
        <Link className="font-semibold mr-auto" href={`/dashboard/links`}>
          <ChevronLeft />
          Back to list
        </Link>
      </Button>
      {loading || !session || !session.user ? (
        <>
          <Skeleton className="w-full md:h-42 sm:h-[203px] h-[215px] bg-background" />
          <Skeleton className="w-full md:h-[236px] sm:h-[268px] h-[528px] bg-background" />
          <Skeleton className="w-full sm:h-[397px] h-[412px] bg-background" />
        </>
      ) : notFound || !url ? (
        <div>Not Found</div>
      ) : (
        <></>
      )}
      {url && session.user && (
        <>
          <LinkDetailsCard currentLink={url} />
          <LinkAdditionsCard qrCode={qrCode} url={url} />
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
