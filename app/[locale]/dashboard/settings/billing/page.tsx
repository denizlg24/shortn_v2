import {
  getCharges,
  getPaymentMethods,
  getStripeExtraInfo,
  getTaxVerification,
  getUserAddress,
  getUserPlan,
} from "@/app/actions/stripeActions";

import { BillingCard } from "@/components/dashboard/settings/billing-card";
import { getServerSession } from "@/lib/session";
import { SubscriptionsType } from "@/utils/plan-utils";
import { setRequestLocale } from "next-intl/server";
import { forbidden } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getServerSession();
  const user = session?.user;
  if (!user) {
    forbidden();
  }
  const extraInfo = await getStripeExtraInfo(user.stripeCustomerId);
  const { plan, lastPaid } = await getUserPlan();
  const [address, verification, paymentMethods, chargeResponse] =
    await Promise.all([
      getUserAddress(user.stripeCustomerId),
      getTaxVerification(user.stripeCustomerId),
      getPaymentMethods(user.stripeCustomerId),
      getCharges(user.stripeCustomerId),
    ]);

  return (
    <BillingCard
      initialUser={{
        tax_id: extraInfo.tax_ids?.data.length
          ? extraInfo.tax_ids.data[0].value
          : undefined,
        phone_number: extraInfo.phone_number,
        stripeId: user.stripeCustomerId,
        plan: {
          subscription: plan as SubscriptionsType,
          lastPaid: lastPaid as Date,
        },
      }}
      initialAddress={address}
      initialVerification={verification}
      initialPaymentMethods={paymentMethods.methods}
      charges={chargeResponse.charges}
      hasMoreCharges={chargeResponse.has_more}
    />
  );
}
