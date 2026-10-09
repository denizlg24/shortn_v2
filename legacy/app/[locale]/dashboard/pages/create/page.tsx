import { setRequestLocale } from "next-intl/server";
import { CreatePage } from "./create-page";
import { getShortn } from "@/utils/fetching-functions";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ urlCode?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { urlCode } = await searchParams;
  const { url } = urlCode ? await getShortn(urlCode) : { url: undefined };
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-4xl mx-auto grid grid-cols-6 gap-6">
        <CreatePage url={url} />
      </div>
    </main>
  );
}
