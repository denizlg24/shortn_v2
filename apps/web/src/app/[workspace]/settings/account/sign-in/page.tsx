import { loadEntitlements } from "@shortn/billing";
import { ssoConnectionPage, ssoProviderPage } from "@shortn/auth/sso-views";
import { SsoConnections } from "@/components/settings/sso/connections";
import { PasskeySettings } from "@/components/settings/account/passkeys";
import { advancedAuthAvailable } from "@shortn/auth/two-factor";
import { physicalNames } from "@shortn/db";
import { ObjectId } from "mongodb";
import { db } from "@/server/db";
import { getTranslations } from "next-intl/server";
import { Connections } from "@/components/settings/account/connections";
import { headers } from "next/headers";
import { auth, socialProviders } from "@/server/auth";
import { AccountPage } from "@/server/account-page";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata() {
  const t = await getTranslations("settings.account.connections");
  return { title: t("title") };
}

export default async function AccountSettingsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/account/sign-in">) {
  const { workspace: slug } = await params;
  const { session, workspace } = await requireWorkspace(slug);
  const t = await getTranslations("settings.account.connections");
  const accounts = await auth().api.listUserAccounts({
    headers: await headers(),
  });
  const { error, passkeyPage, ssoError, ssoConnectedPage, ssoAvailablePage } =
    await searchParams;
  const database = await db();
  const filter = {
    userId: { $in: [session.user.id, new ObjectId(session.user.id)] },
  };
  const total = await database
    .collection(physicalNames.passkeys)
    .countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / 25));
  const requestedPage =
    typeof passkeyPage === "string" && /^\d{1,9}$/.test(passkeyPage)
      ? Number(passkeyPage)
      : 1;
  const page = Math.max(1, Math.min(pages, requestedPage));
  const keys = await database
    .collection(physicalNames.passkeys)
    .find(filter, { projection: { name: 1, createdAt: 1 } })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * 25)
    .limit(25)
    .toArray();
  const [connections, entitlement] = await Promise.all([
    ssoConnectionPage(database, session.user.id, ssoConnectedPage),
    loadEntitlements(database, workspace._id),
  ]);
  const available =
    !workspace.personal &&
    workspace.platformFeatures?.advancedAuth === true &&
    entitlement.plan === "enterprise"
      ? await ssoProviderPage(database, workspace._id, ssoAvailablePage, true)
      : { rows: [], total: 0, page: 1, pages: 1 };
  const bound = await database
    .collection(physicalNames.sso_bindings)
    .find(
      {
        userId: { $in: [session.user.id, new ObjectId(session.user.id)] },
        providerRecordId: { $in: available.rows.map((row) => row.id) },
      },
      { projection: { providerRecordId: 1 } },
    )
    .limit(10)
    .toArray();
  const connectedIds = new Set(
    bound.map((row) => String(row.providerRecordId)),
  );
  return (
    <AccountPage workspace={slug} title={t("title")}>
      <Connections
        accounts={accounts.map((account) => ({
          id: account.id,
          providerId: account.providerId,
          accountId: account.accountId,
        }))}
        providers={socialProviders()}
        returnPath={`/${slug}/settings/account/sign-in`}
        linkError={ssoError ? null : typeof error === "string" ? error : null}
      />
      <div className="mt-10 border-t border-line pt-8">
        <PasskeySettings
          keys={keys.map((key) => ({
            id: String(key._id),
            name: typeof key.name === "string" ? key.name : "",
            createdAt: new Date(key.createdAt).toISOString(),
          }))}
          total={total}
          page={page}
          pages={pages}
          available={await advancedAuthAvailable(database, session.user.id)}
          returnPath={`/${slug}/settings/account/sign-in`}
          passwordPath={`/${slug}/settings/account/password`}
        />
      </div>
      <div className="mt-10 border-t border-line pt-8">
        <SsoConnections
          connections={connections}
          available={{
            ...available,
            rows: available.rows.map((row) => ({
              ...row,
              connected: connectedIds.has(row.id),
            })),
          }}
          workspaceName={workspace.name}
          email={session.user.email}
          returnPath={`/${slug}/settings/account/sign-in`}
          settingsPath={`/${slug}/settings/sso`}
          errorCode={ssoError && typeof error === "string" ? error : null}
        />
      </div>
    </AccountPage>
  );
}
