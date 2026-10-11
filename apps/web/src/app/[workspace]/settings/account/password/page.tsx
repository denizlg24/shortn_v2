import { getTranslations } from "next-intl/server";
import { PasswordSection } from "@/components/settings/account/password-form";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { AccountPage } from "@/server/account-page";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata() {
  const t = await getTranslations("settings.account.password");
  return { title: t("title") };
}

export default async function AccountSettingsPage({
  params,
}: PageProps<"/[workspace]/settings/account/password">) {
  const { workspace: slug } = await params;
  const { session } = await requireWorkspace(slug);
  const t = await getTranslations("settings.account.password");
  const accounts = await auth().api.listUserAccounts({
    headers: await headers(),
  });
  return (
    <AccountPage workspace={slug} title={t("title")}>
      <PasswordSection
        hasPassword={accounts.some(
          (account) => account.providerId === "credential",
        )}
        email={session.user.email}
        providers={accounts
          .map((account) => account.providerId)
          .filter((id) => id !== "credential")}
      />
    </AccountPage>
  );
}
