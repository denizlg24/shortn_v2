import { IQRCode } from "@/models/url/QRCodeV2";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { QRCodeDetailsCard } from "./qr-code-details-card";
import { QRCodeTimeAnalytics } from "./qr-code-time-analytics";
import { QRCodeLocationAnalytics } from "./qr-code-location-analytics";
import { QRCodeTimeByDateData } from "./qr-code-time-by-date-data";
import { ScanDataProvider } from "@/utils/ScanDataContext";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/stripeActions";
import { forbidden } from "next/navigation";

export const QRCodeDetails = async ({ qr }: { qr: IQRCode }) => {
  const session = await getServerSession();
  const { plan } = await getUserPlan();
  if (!session?.user) {
    forbidden();
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
              Back to list
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
