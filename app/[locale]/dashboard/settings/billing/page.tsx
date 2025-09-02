import {
  getTaxVerification,
  getUserAddress,
} from "@/app/actions/stripeActions";
import { getUser } from "@/app/actions/userActions";
import { BillingCard } from "@/components/dashboard/settings/billing-card";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await getUser();
  if (!user) {
    notFound();
  }
  const [address, verification] = await Promise.all([
    getUserAddress(user.stripeId),
    getTaxVerification(user.stripeId),
  ]);
  return (
    <BillingCard user={user} address={address} verification={verification} />
  );
}
