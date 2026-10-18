import { getTranslations } from "next-intl/server";
import { EmailForm } from "@/components/settings/account/email-form";
import { AccountPage } from "@/server/account-page";
import { requireWorkspace } from "@/server/workspace";
import { isEmail } from "@/components/auth/rules";

export async function generateMetadata() {
  const t = await getTranslations("settings.account.email");
  return { title: t("title") };
}

export default async function AccountSettingsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/account/email">) {
  const { workspace: slug } = await params;
  const { session } = await requireWorkspace(slug);
  const t = await getTranslations("settings.account.email");
  const query = await searchParams;
  const requestedEmail =
    typeof query.changeEmail === "string" &&
    query.changeEmail.length <= 254 &&
    isEmail(query.changeEmail)
      ? query.changeEmail.toLowerCase()
      : undefined;
  const confirmation = query.error
    ? query.error === "token_expired"
      ? "expired"
      : "invalid"
    : requestedEmail
      ? session.user.email.toLowerCase() === requestedEmail
        ? "changed"
        : "approved"
      : undefined;

  return (
    <AccountPage workspace={slug} title={t("title")}>
      <EmailForm
        email={session.user.email}
        verified={session.user.emailVerified}
        confirmation={confirmation}
        requestedEmail={requestedEmail}
      />
    </AccountPage>
  );
}
