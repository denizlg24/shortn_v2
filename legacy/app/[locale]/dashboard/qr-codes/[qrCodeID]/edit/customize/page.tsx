import { QRCodeCustomize } from "@/components/dashboard/qr-codes/edit/customize/qr-code-customize";
import { getQRCode } from "@/utils/fetching-functions";
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
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <QRCodeCustomize qrCode={qr} />
      </div>
    </main>
  );
}
