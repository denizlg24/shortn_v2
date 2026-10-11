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
  await requireWorkspace(slug);
  const t = await getTranslations("settings.account.connections");
  const accounts = await auth().api.listUserAccounts({
    headers: await headers(),
  });
  const { error } = await searchParams;
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
        linkError={typeof error === "string" ? error : null}
      />
    </AccountPage>
  );
}
