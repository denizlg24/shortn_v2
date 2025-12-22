import { LoginForm } from "@/components/login/login-form";
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
        <div className="flex flex-col gap-0 w-full text-center items-center">
          <h1 className="lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
            Welcome back!
          </h1>
          <h2 className="lg:text-lg md:text-base text-sm">
            Login to your account and start sharing.
          </h2>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
