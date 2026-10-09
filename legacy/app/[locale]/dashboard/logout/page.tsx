import { Spinner } from "@/components/ui/spinner";
import { setRequestLocale } from "next-intl/server";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="w-full h-full flex flex-col items-center pt-20 gap-1">
      <Spinner className="w-5 h-5" />
      <p className="text-sm font-semibold">Logging you out...</p>
    </main>
  );
}
