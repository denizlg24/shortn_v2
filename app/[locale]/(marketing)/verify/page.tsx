import { VerifiedPage } from "@/components/marketing/verified-page";
import { Skeleton } from "@/components/ui/skeleton";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 mb-16">
      <div className="w-full flex flex-col max-w-lg p-4 gap-6 sm:pt-8">
        <div className="flex flex-col gap-0 w-full">
          <h1 className="lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
            Verifying your email
          </h1>
          <h2 className="lg:text-lg md:text-base text-sm">
            This will only take a moment.
          </h2>
        </div>
        <Suspense fallback={<Skeleton className="w-full h-[150px]" />}>
          <VerifiedPage />
        </Suspense>
      </div>
    </main>
  );
}
