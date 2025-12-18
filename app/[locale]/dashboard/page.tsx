import { QuickCreate } from "@/components/dashboard/home/quick-create";
import { QuickActions } from "@/components/dashboard/home/quick-actions";
import { DashboardOverview } from "@/components/dashboard/home/dashboard-overview";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale } = use<{
    locale: string;
  }>(params);
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-6 grid-cols-1 gap-6">
        <h1 className="col-span-full lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
          Your Connections Platform
        </h1>

        <div className="col-span-full flex flex-col gap-6">
          <QuickCreate />
          <QuickActions />
        </div>
        <DashboardOverview />
      </div>
    </main>
  );
}
