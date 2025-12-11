import { getStripeExtraInfo, getUserPlan } from "@/app/actions/stripeActions";
import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { forbidden, notFound } from "next/navigation";
import { SubscribeForm } from "./subscribe-form";

import { getRelativeOrder, SubscriptionsType } from "@/utils/plan-utils";
import { UpgradeForm } from "./upgrade-form";
import { DowngradeForm } from "./downgrade-form";
import { getServerSession } from "@/lib/session";

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
    forbidden();
  }
  const stripeCustomer = await getStripeExtraInfo(
    session.user.stripeCustomerId,
  );
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
          user={{
            ...session.user,
            tax_ids: stripeCustomer.tax_ids?.data || [],
            phone_number: stripeCustomer.phone_number,
          }}
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
  if (relativeOrder < 0) {
    return (
      <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
        <DowngradeForm
          tier={tier as SubscriptionsType}
          currentPlan={response.plan}
        />
      </main>
    );
  }
  if (relativeOrder > 0) {
    return (
      <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
        <UpgradeForm
          user={{
            ...session.user,
            tax_ids: stripeCustomer.tax_ids?.data || [],
            phone_number: stripeCustomer.phone_number,
          }}
          address={stripeCustomer.address}
          tier={tier as "basic" | "plus" | "pro"}
          upgradeLevel={relativeOrder}
        />
      </main>
    );
  }
}
