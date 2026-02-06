import { IQRCode } from "@/models/url/QRCodeV2";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { QRCodeDetailsCard } from "./qr-code-details-card";
import { QRCodeTimeAnalytics } from "./qr-code-time-analytics";
import { QRCodeLocationAnalytics } from "./qr-code-location-analytics";
import { QRCodeTimeByDateData } from "./qr-code-time-by-date-data";
import { ScanDataProvider } from "@/utils/ScanDataContext";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/polarActions";
import { getTranslations } from "next-intl/server";

export const QRCodeDetails = async ({
  qr,
  locale,
}: {
  qr: IQRCode;
  locale: string;
}) => {
  const session = await getServerSession();
  const { plan } = await getUserPlan();
  const t = await getTranslations("dashboard");
  if (!session?.user) {
    redirect({ href: "/dashboard/logout", locale: locale });
    return;
  }
  return (
    <>
      {qr && session.user && (
        <ScanDataProvider urlCode={qr.qrCodeId}>
          <Button variant={"link"} asChild>
            <Link
              className="font-semibold mr-auto"
              href={`/dashboard/qr-codes`}
            >
              <ChevronLeft />
              {t("qr-code-details-back")}
            </Link>
          </Button>
          <QRCodeDetailsCard
            qrCode={{ ...qr, _id: (qr._id as string).toString() }}
          />
          <QRCodeTimeAnalytics
            createdAt={qr.date}
            unlocked={plan == "plus" || plan == "pro"}
          />
          <QRCodeTimeByDateData
            unlocked={plan == "plus" || plan == "pro"}
            createdAt={qr.date}
          />
          <QRCodeLocationAnalytics
            unlocked={
              plan == "pro" ? "all" : plan == "plus" ? "location" : "none"
            }
          />
        </ScanDataProvider>
      )}
    </>
  );
};
