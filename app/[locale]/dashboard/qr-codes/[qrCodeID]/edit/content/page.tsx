import { QRCodeEditContent } from "@/components/dashboard/qr-codes/edit/content/qr-code-edit-content";
import { QRCodeCustomize } from "@/components/dashboard/qr-codes/edit/customize/qr-code-customize";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale, qrCodeID } = use<{
    locale: string;
    qrCodeID: string;
  }>(params);
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-12! pb-16">
      <div className="w-full max-w-4xl mx-auto grid grid-cols-6 gap-6">
        <QRCodeEditContent qrCodeId={qrCodeID} />
      </div>
    </main>
  );
}
