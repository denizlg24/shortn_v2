import { LinksEditContent } from "@/components/dashboard/links/edit/link-edit-content";
import { getShortn } from "@/utils/fetching-functions";
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
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-4xl mx-auto grid grid-cols-6 gap-6">
        <LinksEditContent url={url} />
      </div>
    </main>
  );
}
