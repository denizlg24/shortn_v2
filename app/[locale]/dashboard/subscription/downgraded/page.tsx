import env from "@/utils/env";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import jwt from "jsonwebtoken";
import { SubscriptionsType } from "@/utils/plan-utils";
import { DowngradedCard } from "./downgraded-card";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | unknown>>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  if (!token) {
    notFound();
  }
  let decoded: { plan: SubscriptionsType };
  try {
    decoded = jwt.verify(token as string, env.AUTH_SECRET) as {
      plan: SubscriptionsType;
    };
  } catch {
    notFound();
  }
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <DowngradedCard plan={decoded.plan} />
    </main>
  );
}
