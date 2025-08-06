import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale, organization } = use<{
    locale: string;
    organization: string;
  }>(params);
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent sm:pt-14! pt-12! pb-16">
      PAGES
    </main>
  );
}
