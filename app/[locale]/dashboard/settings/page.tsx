import { getUser } from "@/app/actions/userActions";
import { ProfileCard } from "@/components/dashboard/settings/profile-card";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { success, user } = await getUser();
  if (!success || !user) {
    notFound();
  }
  return <ProfileCard initialUser={user} />;
}
