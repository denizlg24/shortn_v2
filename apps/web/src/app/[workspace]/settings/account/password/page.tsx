import { getTranslations } from "next-intl/server";
import { PasswordSection } from "@/components/settings/account/password-form";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { AccountPage } from "@/server/account-page";
import { requireWorkspace } from "@/server/workspace";
import { twoFactorEnrollmentAllowed } from "@shortn/auth/two-factor";
import { db } from "@/server/db";
import { TwoFactorSettings } from "@/components/settings/account/two-factor";

export async function generateMetadata() {
  const t = await getTranslations("settings.account.twoFactor");
  return { title: t("pageTitle") };
}

export default async function AccountSettingsPage({
  params,
}: PageProps<"/[workspace]/settings/account/password">) {
  const { workspace: slug } = await params;
  const { session } = await requireWorkspace(slug);
  const t = await getTranslations("settings.account.twoFactor");
  const accounts = await auth().api.listUserAccounts({
    headers: await headers(),
  });
  return (
    <AccountPage workspace={slug} title={t("pageTitle")}>
      <PasswordSection
        hasPassword={accounts.some(
          (account) => account.providerId === "credential",
        )}
        email={session.user.email}
        providers={accounts
          .map((account) => account.providerId)
          .filter((id) => id !== "credential")}
      />
      <div className="mt-10 border-t border-line pt-8">
        <TwoFactorSettings
          active={Boolean(session.user.twoFactorEnabled)}
          available={await twoFactorEnrollmentAllowed(await db(), session.user)}
          hasPassword={accounts.some(
            (account) => account.providerId === "credential",
          )}
        />
      </div>
    </AccountPage>
  );
}
