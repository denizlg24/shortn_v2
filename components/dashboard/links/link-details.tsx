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

export const LinkDetails = ({ urlCode }: { urlCode: string }) => {
  const [loading, setLoading] = useState(true);
  const session = useUser();
  const [url, setUrl] = useState<IUrl | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

  const getUrlWrapper = async (code: string, sub: string) => {
    try {
      const { success, url } = await getShortn(sub, code);
      if (success && url) {
        setUrl(url);
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
    getUrlWrapper(urlCode, session.user.sub);
  }, [urlCode, session.user]);

  return (
    <>
      <Button variant={"link"} asChild>
        <Link
          className="font-semibold mr-auto"
          href={`/dashboard/${session?.user?.sub.split("|")[1]}/links`}
        >
          <ChevronLeft />
          Back to list
        </Link>
      </Button>
      {loading || !session || !session.user ? (
        <>
          <Skeleton className="w-full h-42 bg-background" />
          <Skeleton className="w-full h-42 bg-background" />
        </>
      ) : notFound || !url ? (
        <div>Not Found</div>
      ) : (
        <></>
      )}
      {url && (
        <>
          <LinkDetailsCard currentLink={url} />
          <LinkAdditionsCard currentLink={url} />
        </>
      )}
    </>
  );
};
