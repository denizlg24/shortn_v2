import { loadEntitlements } from "@shortn/billing";
import { ssoProviderPage } from "@shortn/auth/sso-views";
import { getTranslations } from "next-intl/server";
import { Page } from "@/components/page/page";
import { SsoProviderSettings } from "@/components/settings/sso/provider-settings";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata() {
  const t = await getTranslations("settings.sso");
  return { title: t("title") };
}
export default async function SsoSettingsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/sso">) {
  const slug = (await params).workspace,
    { workspace, actor } = await requireWorkspace(slug),
    database = await db();
  const [t, entitlement, providers] = await Promise.all([
    getTranslations("settings.sso"),
    loadEntitlements(database, workspace),
    searchParams.then((query) =>
      ssoProviderPage(database, workspace._id, query.page),
    ),
  ]);
  const owner =
    actor.role === "owner" && workspace.ownerUserId === actor.userId;
  const reason = workspace.personal
    ? "personal"
    : !owner
      ? "owner"
      : entitlement.plan !== "enterprise"
        ? "enterprise"
        : workspace.platformFeatures?.advancedAuth !== true
          ? "flag"
          : null;
  return (
    <Page
      title={t("title")}
      description={t("pageDescription", { workspace: workspace.name })}
      width="form"
      crumbs={[
        { label: t("settings"), href: `/${slug}/settings` },
        { label: t("title") },
      ]}
    >
      <SsoProviderSettings
        {...providers}
        workspaceId={String(workspace._id)}
        owner={owner}
        eligible={!reason}
        reason={reason}
        returnPath={`/${slug}/settings/sso`}
        origin={new URL(env().BETTER_AUTH_URL).origin}
      />
    </Page>
  );
}
