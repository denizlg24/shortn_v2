"use client";

import { usePathname } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QRCodeCreate } from "./qr-code-create";
import { useUser } from "@/utils/UserContext";
import { IUrl } from "@/models/url/UrlV3";
import { QRCodeAttach } from "./qr-code-attatch";
import { getShortn } from "@/utils/fetching-functions";

export const QRCodeCreateRouter = () => {
  const session = useUser();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [stateReady, setStateReady] = useState(false);
  const [link, setLink] = useState<IUrl | undefined>(undefined);
  const [state, setState] = useState<
    "configure" | "customize" | "attachToLink" | undefined
  >(undefined);

  const getShortLink = async (id: string) => {
    const shortnResponse = await getShortn(id);
    if (shortnResponse.success && shortnResponse.url) {
      setLink(shortnResponse.url);
      setState("attachToLink");
      setStateReady(true);
    }
  };

  useEffect(() => {
    if (!session.user) {
      return;
    }
    setStateReady(false);
    const dynamic_id = searchParams.get("dynamic_id");
    if (dynamic_id) {
      getShortLink(dynamic_id);
      return;
    }
    setState("configure");
    setStateReady(true);
  }, [pathname, searchParams.toString(), session.user]);

  if (!stateReady || state == undefined) {
    return (
      <div className="w-full flex flex-col items-center justify-center">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  switch (state) {
    case "configure":
      return <QRCodeCreate state="configure" setState={setState} />;
    case "customize":
      return <QRCodeCreate state="customize" setState={setState} />;
    case "attachToLink":
      return <QRCodeAttach linkToAttach={link!} />;
  }
};
