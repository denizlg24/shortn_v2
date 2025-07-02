import { VerificationHolder } from "@/components/register/verification-holder";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale, email, token } = use<{
    locale: string;
    email: string;
    token: string;
  }>(params);
  setRequestLocale(locale);

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 mb-16">
      <div className="w-full flex flex-col max-w-lg p-4 gap-6 sm:pt-8">
        <VerificationHolder email={email} token={token} />
      </div>
    </main>
  );
}
