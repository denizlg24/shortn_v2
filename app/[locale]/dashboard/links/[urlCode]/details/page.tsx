import { LinkDetails } from "@/components/dashboard/links/link-details";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale, urlCode } = use<{
    locale: string;
    urlCode: string;
  }>(params);
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full col-span-full flex flex-col gap-4">
          <LinkDetails urlCode={urlCode} />
        </div>
      </div>
    </main>
  );
}
