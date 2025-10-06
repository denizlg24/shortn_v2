import { QRCodeDetails } from "@/components/dashboard/qr-codes/qr-code-details";
import { ClickEntry } from "@/models/url/Click";
import { getQRCode, getScans } from "@/utils/fetching-functions";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string; qrCodeID: string }>;
}) {
  const { locale, qrCodeID } = await params;
  setRequestLocale(locale);

  const { success, qr } = await getQRCode(qrCodeID);
  if (!success || !qr) {
    notFound();
  }
  const clicks = await getScans(qrCodeID) as ClickEntry[];
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full col-span-full flex flex-col gap-4">
          <QRCodeDetails clicks={clicks} qr={qr} />
        </div>
      </div>
    </main>
  );
}
