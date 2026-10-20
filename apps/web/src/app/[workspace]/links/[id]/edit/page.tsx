import { listTags } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { LinkForm } from "@/components/link-pages/link-form";
import { Page } from "@/components/page/page";
import { gateOf } from "@/lib/plan-features";
import { updateLinkPageAction } from "@/server/actions/link-pages";
import { linkTabs, loadLink } from "@/server/link-page";
import { planFeatures } from "@/server/plan";

export async function generateMetadata() {
  const t = await getTranslations("linkPages.form");
  return { title: t("editTitle") };
}

export default async function EditLinkPage({
  params,
}: PageProps<"/[workspace]/links/[id]/edit">) {
  const { workspace, id } = await params;
  const t = await getTranslations("linkPages");
  const [{ ctx, link }, features] = await Promise.all([
    loadLink(workspace, id),
    planFeatures(workspace),
  ]);
  const tags = await listTags(ctx);
  const base = `/${workspace}/links/${id}`;
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: `${link.domain}/${link.key}`, href: base },
        { label: t("tabs.edit") },
      ]}
      title={`${link.domain}/${link.key}`}
      description={t("form.editDescription")}
      tabs={linkTabs(workspace, id, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
      width="form"
    >
      <LinkForm
        mode="edit"
        domain={link.domain}
        initial={{
          ...(link.rules ? { rules: link.rules } : {}),
          ...(link.og ? { og: link.og } : {}),
          url: link.url,
          key: link.key,
          title: link.title,
          description: link.description ?? "",
          tags: link.tags.map((tag) => tag.name),
          hasPassword: Boolean(link.password),
          passwordHint: link.password?.hint ?? "",
        }}
        allTags={tags}
        gates={{
          customKeys: gateOf(features.customKeys),
          passwords: gateOf(features.passwords),
        }}
        action={updateLinkPageAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
