import { NavigationBarContainer } from "@/components/dashboard/settings/navigation-bar-container";
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
  return <div></div>;
}
