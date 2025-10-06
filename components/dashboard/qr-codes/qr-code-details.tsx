"use client";
import { useUser } from "@/utils/UserContext";
import { IQRCode } from "@/models/url/QRCodeV2";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { QRCodeDetailsCard } from "./qr-code-details-card";
import { QRCodeTimeAnalytics } from "./qr-code-time-analytics";
import { QRCodeLocationAnalytics } from "./qr-code-location-analytics";
import { QRCodeTimeByDateData } from "./qr-code-time-by-date-data";
import { ClickEntry } from "@/models/url/Click";

export const QRCodeDetails = ({ qr,clicks }: { qr: IQRCode,clicks:ClickEntry[] }) => {
  const session = useUser();

  return (
    <>
      {qr && session.user && (
        <>
          <Button variant={"link"} asChild>
            <Link
              className="font-semibold mr-auto"
              href={`/dashboard/qr-codes`}
            >
              <ChevronLeft />
              Back to list
            </Link>
          </Button>
          <QRCodeDetailsCard qrCode={qr} />
          <QRCodeTimeAnalytics
            createdAt={qr.date}
            unlocked={session.user.plan.subscription != "free"}
            clicks={clicks}
          />
          <QRCodeTimeByDateData
            unlocked={
              session.user.plan.subscription == "plus" ||
              session.user.plan.subscription == "pro"
            }
            clicks={clicks}
            createdAt={qr.date}
          />
          <QRCodeLocationAnalytics
            unlocked={
              session.user.plan.subscription == "pro"
                ? "all"
                : session.user.plan.subscription == "plus"
                ? "location"
                : "none"
            }
            clicks={clicks}
          />
        </>
      )}
    </>
  );
};
