import { setRequestLocale } from "next-intl/server";
import { use } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Home({ params }: { params: any }) {
  const { locale } = use<{
    locale: string;
  }>(params);
  setRequestLocale(locale);
  return <div></div>;
}
