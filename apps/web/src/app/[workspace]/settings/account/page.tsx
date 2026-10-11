import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/settings/account/profile-form";
import { AccountPage } from "@/server/account-page";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata() {
  const t = await getTranslations("settings.account.profile");
  return { title: t("title") };
}

export default async function ProfilePage({
  params,
}: PageProps<"/[workspace]/settings/account">) {
  const { workspace: slug } = await params;
  const { session } = await requireWorkspace(slug);
  const t = await getTranslations("settings.account.profile");
  return (
    <AccountPage workspace={slug} title={t("title")}>
      <ProfileForm
        user={{
          name: session.user.name,
          username: session.user.username ?? "",
          image: session.user.image ?? "",
          email: session.user.email,
          emailVerified: session.user.emailVerified,
        }}
      />
    </AccountPage>
  );
}
