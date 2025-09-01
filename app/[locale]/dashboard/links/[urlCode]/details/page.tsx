import { LinkDetails } from "@/components/dashboard/links/link-details";
import { getQRCode, getShortn } from "@/utils/fetching-functions";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string; urlCode: string }>;
}) {
  const { locale, urlCode } = await params;
  setRequestLocale(locale);

  const { success, url } = await getShortn(urlCode);
  if (!success || !url) {
    notFound();
  }
  const { success: qrCodeSuccess, qr } = url.qrCodeId
    ? await getQRCode(url.qrCodeId)
    : { success: true, qr: undefined };
  if (!qrCodeSuccess) {
    notFound();
  }

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full col-span-full flex flex-col gap-4">
          <LinkDetails url={url} qr={qr} />
        </div>
      </div>
    </main>
  );
}
