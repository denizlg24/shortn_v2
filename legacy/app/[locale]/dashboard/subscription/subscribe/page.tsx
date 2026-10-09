import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getRelativeOrder, SubscriptionsType } from "@/utils/plan-utils";
import { DowngradeForm } from "./downgrade-form";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/polarActions";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | unknown>>;
}) {
  const { locale } = await params;
  const { tier } = await searchParams;
  setRequestLocale(locale);

  if (!tier || !["free", "basic", "plus", "pro"].includes(tier as string)) {
    redirect({ href: "/dashboard/subscription", locale });
  }
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    redirect({ href: "/dashboard/logout", locale: locale });
    return;
  }

  const response = await getUserPlan();
  if (!response.plan) {
    notFound();
  }
  if (tier == response.plan) {
    redirect({ href: "/dashboard/settings/plan", locale });
  }

  if (response.plan == "free") {
    redirect({ href: "/dashboard/subscription", locale });
  }
  const relativeOrder = getRelativeOrder(
    response.plan as SubscriptionsType,
    tier as SubscriptionsType,
  );
  if (relativeOrder == 0) {
    redirect({ href: "/dashboard/settings/plan", locale });
  }
  if (relativeOrder < 0) {
    if (tier === "free") {
      redirect({ href: "/dashboard/settings/plan", locale });
    }
    return (
      <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
        <DowngradeForm
          tier={tier as SubscriptionsType}
          currentPlan={response.plan as SubscriptionsType}
        />
      </main>
    );
  }
  if (relativeOrder > 0) {
    redirect({ href: "/dashboard/subscription", locale });
  }
}
