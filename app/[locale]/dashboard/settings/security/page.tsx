import { getLoginRecords, getUser } from "@/app/actions/userActions";
import { SecurityCard } from "@/components/dashboard/settings/security-card";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await getUser();
  if (!user) {
    notFound();
  }
  const { loginRecords } = await getLoginRecords({ limit: 4, sub: user.sub });
  const { loginRecords: fullLoginRecords } = await getLoginRecords({
    sub: user.sub,
    limit: undefined,
  });
  return (
    <SecurityCard
      loginRecords={loginRecords}
      fullLoginRecords={fullLoginRecords}
    />
  );
}
