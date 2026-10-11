import { UtmGate } from "@/components/link-pages/utm-gate";
import { campaignsAccess } from "@/server/campaign-page";
import { can } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { DeleteUtm } from "@/components/link-pages/delete-utm";
import { Page } from "@/components/page/page";
import { removeUtmVariantAction } from "@/server/actions/link-pages";
import { loadLink } from "@/server/link-page";

export async function generateMetadata() {
  const t = await getTranslations("linkPages.utm");
  return { title: t("deleteTitle") };
}

export default async function DeleteUtmPage({
  params,
}: PageProps<"/[workspace]/links/[id]/utm/[index]/delete">) {
  const { workspace, id, index } = await params;
  const t = await getTranslations("linkPages");
  const { ctx, link } = await loadLink(workspace, id);
  const access = await campaignsAccess(workspace);
  if (!access.allowed)
    return <UtmGate workspace={workspace} link={link} plan={access.plan} />;
  const base = `/${workspace}/links/${id}`;
  if (!can(ctx.actor, "resource.update")) redirect(`${base}/utm`);
  const position = /^\d+$/.test(index) ? Number(index) : -1;
  const variant = Number.isSafeInteger(position)
    ? link.utm[position]
    : undefined;
  if (!variant) notFound();
  const expected = link.utm.map((item) => ({
    source: item.source ?? undefined,
    medium: item.medium ?? undefined,
    campaign: item.campaign ?? undefined,
    term: item.term ?? undefined,
    content: item.content ?? undefined,
  }));
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: `${link.domain}/${link.key}`, href: base },
        { label: t("tabs.utm"), href: `${base}/utm` },
        { label: t("utm.deleteTitle") },
      ]}
      title={t("utm.deleteTitle")}
      description={t("utm.deleteDescription")}
      width="form"
    >
      <DeleteUtm
        variant={expected[position]!}
        action={removeUtmVariantAction.bind(
          null,
          workspace,
          id,
          position,
          expected,
        )}
        cancelHref={`${base}/utm`}
      />
    </Page>
  );
}
