import { getLoginRecords } from "@/app/actions/userActions";
import { SecurityCard } from "@/components/dashboard/settings/security-card";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import { setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
type SessionWithGeo = {
  id: string;
  createdAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  geo_city?: string | null;
  geo_country?: string | null;
  geo_country_region?: string | null;
  geo_region?: string | null;
  geo_latitude?: string | null;
  geo_longitude?: string | null;
};

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
    redirect({ href: "/dashboard/logout", locale: locale });
    return;
  }
  const { loginRecords } = await getLoginRecords({ limit: 4, sub: user.sub });
  const { loginRecords: fullLoginRecords } = await getLoginRecords({
    sub: user.sub,
    limit: undefined,
  });
  const devices = await auth.api.listSessions({ headers: await headers() });
  const loggedInDevices = devices.map((device) => {
    const deviceWithGeo = device as SessionWithGeo;
    return {
      ipAddress: deviceWithGeo.ipAddress ?? undefined,
      createdAt: deviceWithGeo.createdAt,
      id: deviceWithGeo.id,
      userAgent: deviceWithGeo.userAgent ?? undefined,
      geo_city: deviceWithGeo.geo_city ?? undefined,
      geo_country: deviceWithGeo.geo_country ?? undefined,
      geo_country_region: deviceWithGeo.geo_country_region ?? undefined,
      geo_region: deviceWithGeo.geo_region ?? undefined,
      geo_latitude: deviceWithGeo.geo_latitude ?? undefined,
      geo_longitude: deviceWithGeo.geo_longitude ?? undefined,
    };
  });
  return (
    <SecurityCard
      loginRecords={loginRecords}
      fullLoginRecords={fullLoginRecords}
      loggedInDevices={loggedInDevices}
    />
  );
}
