import { RecoverPassword } from "@/components/login/recover-password";
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
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 mb-16">
      <div className="w-full flex flex-col max-w-lg px-4 py-6 gap-6 sm:pt-16">
        <RecoverPassword />
      </div>
    </main>
  );
}
