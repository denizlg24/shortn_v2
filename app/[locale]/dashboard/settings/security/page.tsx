import { getLoginRecords } from "@/app/actions/userActions";
import { SecurityCard } from "@/components/dashboard/settings/security-card";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
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
  const { loginRecords } = await getLoginRecords({ limit: 4, sub: user.sub });
  const { loginRecords: fullLoginRecords } = await getLoginRecords({
    sub: user.sub,
    limit: undefined,
  });
  const devices = await auth.api.listSessions({ headers: await headers() });
  const loggedInDevices = devices.map((device) => ({
    ipAddress: device.ipAddress ?? undefined,
    createdAt: device.createdAt,
    id: device.id,
    userAgent: device.userAgent ?? undefined,
  }));
  return (
    <SecurityCard
      loginRecords={loginRecords}
      fullLoginRecords={fullLoginRecords}
      loggedInDevices={loggedInDevices}
    />
  );
}
