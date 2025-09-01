import { QRCodeCreateRouter } from "@/components/dashboard/qr-codes/create/qr-code-create-router";
import { getShortn } from "@/utils/fetching-functions";
import { setRequestLocale } from "next-intl/server";

export default async function Home({
  params,
  searchParams,
}: {
   
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const attachedUrl = (await searchParams).dynamic_id;
  const { url } = attachedUrl
    ? await getShortn(attachedUrl)
    : { url: undefined };
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <QRCodeCreateRouter link={url} />
      </div>
    </main>
  );
}
