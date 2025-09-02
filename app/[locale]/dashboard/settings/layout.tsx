import { NavigationBarContainer } from "@/components/dashboard/settings/navigation-bar-container";
import { setRequestLocale } from "next-intl/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent pb-16">
      <div className="w-full flex flex-col gap-4 items-start lg:p-8! md:p-6! p-4!">
        <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
          Your Settings
        </h1>
        <NavigationBarContainer />
        {children}
      </div>
    </main>
  );
}
