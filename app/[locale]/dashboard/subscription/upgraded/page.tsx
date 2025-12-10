import env from "@/utils/env";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import jwt from "jsonwebtoken";
import { UpgradedCard } from "./upgraded-card";

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
  let decoded: { plan: string; type?: "upgrade" | "subscribe" };
  try {
    decoded = jwt.verify(token as string, env.AUTH_SECRET) as {
      plan: string;
      type?: "upgrade" | "subscribe";
    };
  } catch {
    notFound();
  }
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <UpgradedCard plan={decoded.plan} type={decoded.type} />
    </main>
  );
}
