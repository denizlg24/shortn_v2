import { listTags } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { LinkForm } from "@/components/link-pages/link-form";
import { emptyLinkValues } from "@/components/link-pages/link-form-values";
import { Page } from "@/components/page/page";
import { gateOf } from "@/lib/plan-features";
import { createLinkPageAction } from "@/server/actions/link-pages";
import { serviceContext } from "@/server/context";
import { env } from "@/server/env";
import { planFeatures } from "@/server/plan";

export async function generateMetadata() {
  const t = await getTranslations("linkPages.form");
  return { title: t("newTitle") };
}

export default async function NewLinkPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/links/new">) {
  const { workspace } = await params;
  const { url } = await searchParams;
  const t = await getTranslations("linkPages");
  const [ctx, features] = await Promise.all([
    serviceContext(workspace),
    planFeatures(workspace),
  ]);
  const tags = await listTags(ctx);
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: t("form.newTitle") },
      ]}
      title={t("form.newTitle")}
      description={t("form.newDescription")}
      width="form"
    >
      <LinkForm
        mode="create"
        workspace={workspace}
        domain={env().LINK_DOMAIN}
        initial={{
          ...emptyLinkValues,
          url: typeof url === "string" ? url.slice(0, 2048) : "",
        }}
        allTags={tags}
        gates={{
          customKeys: gateOf(features.customKeys),
          passwords: gateOf(features.passwords),
        }}
        action={createLinkPageAction.bind(null, workspace)}
        cancelHref={`/${workspace}/links`}
      />
    </Page>
  );
}
