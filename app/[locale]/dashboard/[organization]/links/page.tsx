import { LinkContainer } from "@/components/dashboard/links/link-container";
import { LinkFilterBar } from "@/components/dashboard/links/link-filter-bar";
import { SortingControls } from "@/components/dashboard/links/sorting-controls";
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
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <h1 className="col-span-full lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
          Your Shortn Links
        </h1>
        <LinkFilterBar />
        <SortingControls
          label="Sort links by"
          className="-mt-3 col-span-full"
        />
        <LinkContainer />
      </div>
    </main>
  );
}
