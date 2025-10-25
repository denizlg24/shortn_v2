import { getStripeExtraInfo, getUserPlan } from "@/app/actions/stripeActions";
import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SubscribeForm } from "./subscribe-form";
import { getUser } from "@/app/actions/userActions";
import { getRelativeOrder, SubscriptionsType } from "@/utils/plan-utils";
import { UpgradeForm } from "./upgrade-form";

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
  const user = await getUser();
  if (!user.user) {
    notFound();
  }
  const stripeCustomer = await getStripeExtraInfo(user.user.stripeId);
  const response = await getUserPlan();
  if (!response.success || !response.plan) {
    notFound();
  }
  if (tier == response.plan) {
    redirect({ href: "/dashboard/settings/plan", locale });
  }

  if (response.plan == "free") {
    return (
      <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
        <SubscribeForm
          user={user.user}
          address={stripeCustomer.address}
          tier={tier as "basic" | "plus" | "pro"}
        />
      </main>
    );
  }
  const relativeOrder = getRelativeOrder(
    response.plan,
    tier as SubscriptionsType,
  );
  if (relativeOrder == 0) {
    redirect({ href: "/dashboard/settings/plan", locale });
  }
  if (relativeOrder > 0) {
    return (
      <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
        <UpgradeForm
          user={user.user}
          address={stripeCustomer.address}
          tier={tier as "basic" | "plus" | "pro"}
          upgradeLevel={relativeOrder}
        />
      </main>
    );
  }
}
