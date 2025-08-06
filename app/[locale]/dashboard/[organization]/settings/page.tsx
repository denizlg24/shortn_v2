import { NavigationBarContainer } from "@/components/dashboard/settings/navigation-bar-container";
import { ProfileCard } from "@/components/dashboard/settings/profile-card";
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
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent">
      <div className="w-full flex flex-col gap-4 items-start lg:p-8! md:p-6! p-4!">
        <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
          Your Settings
        </h1>
        <NavigationBarContainer />
        <ProfileCard />
      </div>
    </main>
  );
}
