import { getUser } from "@/app/actions/userActions";
import { NavigationBarContainer } from "@/components/dashboard/settings/navigation-bar-container";
import { ProfileCard } from "@/components/dashboard/settings/profile-card";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { use } from "react";

export default async function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { success, user } = await getUser();
  if (!success || !user) {
    notFound();
  }
  return <ProfileCard user={user} />;
}
