import { getShortn } from "@/app/actions/linkActions";
import { getQRCode } from "@/app/actions/qrCodeActions";
import { LinkDetails } from "@/components/dashboard/links/link-details";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full col-span-full flex flex-col gap-4">
          <LinkDetails urlCode={urlCode} url={url} qr={qr} />
        </div>
      </div>
    </main>
  );
}
