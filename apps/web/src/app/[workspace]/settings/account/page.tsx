import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { AccountPanel } from "@/components/settings/account/account-panel";
import type { SessionRow } from "@/components/settings/account/sessions";
import { describeUserAgent } from "@/components/settings/account/user-agent";
import { SettingsPage } from "@/components/settings/section";
import { settingsHref } from "@/components/settings/tabs";
import { auth, socialProviders } from "@/server/auth";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("nav.account")} · ${t("title")}` };
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

// Account settings are per user; they sit under the workspace URL only so
// the shell and its navigation stay in place.
export default async function AccountSettingsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/account">) {
  const { session, workspace } = await requireWorkspace(
    (await params).workspace,
  );
  const requestHeaders = await headers();
  const [sessions, accounts, { error }, t, format, locale] = await Promise.all([
    auth().api.listSessions({ headers: requestHeaders }),
    auth().api.listUserAccounts({ headers: requestHeaders }),
    searchParams,
    getTranslations("settings.account"),
    getFormatter(),
    getLocale(),
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
    <SettingsPage title={t("title")} description={t("description")}>
      <AccountPanel
        user={{
          name: session.user.name,
          username: session.user.username ?? "",
          image: session.user.image ?? "",
          email: session.user.email,
          emailVerified: session.user.emailVerified,
        }}
        accounts={accounts.map((account) => ({
          id: account.id,
          providerId: account.providerId,
          accountId: account.accountId,
        }))}
        providers={socialProviders()}
        sessions={rows}
        returnPath={settingsHref(workspace.slug, "account")}
        linkError={typeof error === "string" ? error : null}
      />
    </SettingsPage>
  );
}
