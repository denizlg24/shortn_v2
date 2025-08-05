import { LinksCreate } from "@/components/dashboard/links/create/links-create";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale } = use<{ locale: string }>(params);
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-12!">
      <div className="w-full max-w-4xl mx-auto grid grid-cols-6 gap-6">
        <LinksCreate />
      </div>
    </main>
  );
}
