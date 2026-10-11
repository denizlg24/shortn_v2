import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { BioCreateForm } from "@/components/bio/bio-create-form";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { UpgradeLink } from "@/components/plan-gate";
import { createBioPageAction } from "@/server/actions/bio-pages";
import { env } from "@/server/env";
import { billingOverview } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata() {
  const t = await getTranslations("bio.new");
  return { title: t("title") };
}

export default async function NewBioPage({
  params,
}: PageProps<"/[workspace]/bio/new">) {
  const { workspace } = await params;
  const { actor } = await requireWorkspace(workspace);
  if (!can(actor, "resource.create")) redirect(`/${workspace}/bio`);
  const t = await getTranslations("bio");
  const overview = await billingOverview(workspace);
  const limit = overview.limits.bioPages;
  const atLimit = limit !== null && overview.usage.bioPages >= limit;
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/bio` },
        { label: t("new.title") },
      ]}
      title={t("new.title")}
      description={t("new.description")}
      width="form"
    >
      {atLimit ? (
        <Notice tone="warning">
          {t("new.atLimit", { limit })} <UpgradeLink />
        </Notice>
      ) : null}
      <BioCreateForm
        workspace={workspace}
        host={new URL(env().PUBLIC_ORIGIN).host}
        action={createBioPageAction.bind(null, workspace)}
        cancelHref={`/${workspace}/bio`}
      />
    </Page>
  );
}
