import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import {
  Sessions,
  type SessionRow,
} from "@/components/settings/account/sessions";
import { describeUserAgent } from "@/components/settings/account/user-agent";
import { AccountPage } from "@/server/account-page";
import { auth } from "@/server/auth";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata() {
  const t = await getTranslations("settings.account.sessions");
  return { title: t("title") };
}

const regionNames = new Map<string, Intl.DisplayNames>();
function countryName(code: string, locale: string) {
  let names = regionNames.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: "region" });
    regionNames.set(locale, names);
  }
  try {
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export default async function SessionsPage({
  params,
}: PageProps<"/[workspace]/settings/account/sessions">) {
  const { workspace: slug } = await params;
  const { session } = await requireWorkspace(slug);
  // Staff impersonating see only their own session: the full list carries
  // the user's other session tokens, and auth refuses it.
  const impersonated = Boolean(session.session.impersonatedBy);
  const [sessions, format, locale, t] = await Promise.all([
    impersonated
      ? [session.session]
      : auth().api.listSessions({ headers: await headers() }),
    getFormatter(),
    getLocale(),
    getTranslations("settings.account.sessions"),
  ]);
  const now = new Date();

  const updated = (item: { updatedAt: Date | string }) =>
    new Date(item.updatedAt).getTime();
  const rows: SessionRow[] = sessions
    .toSorted(
      (a, b) =>
        Number(b.id === session.session.id) -
          Number(a.id === session.session.id) || updated(b) - updated(a),
    )
    .map((item) => {
      const current = item.id === session.session.id;
      const place = [
        item.geo_city,
        item.geo_country ? countryName(item.geo_country, locale) : null,
      ].filter((part): part is string => Boolean(part));
      return {
        id: item.id,
        // The current session is never revoked from here, so its token
        // doesn't need to reach the browser.
        token: current ? null : item.token,
        current,
        impersonated: Boolean(item.impersonatedBy),
        device: describeUserAgent(item.userAgent ?? null),
        location: place.length > 0 ? place.join(", ") : null,
        lastActive: format.relativeTime(new Date(item.updatedAt), now),
      };
    });

  return (
    <AccountPage workspace={slug} title={t("title")}>
      <Sessions sessions={rows} />
    </AccountPage>
  );
}
