import { ProfileCard } from "@/components/dashboard/settings/profile-card";
import { getServerSession } from "@/lib/session";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

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
    notFound();
  }
  return <ProfileCard initialUser={user} />;
}
