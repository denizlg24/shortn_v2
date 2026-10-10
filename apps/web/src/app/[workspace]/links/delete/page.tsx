import { can, getLink } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DeleteLinks } from "@/components/link-pages/delete-links";
import { Page } from "@/components/page/page";
import { serviceContext } from "@/server/context";

export async function generateMetadata() {
  const t = await getTranslations("linkPages.delete");
  return { title: t("title") };
}

// Bulk delete: the list's checkboxes submit here as ?ids=…
export default async function DeleteSelectedPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/links/delete">) {
  const { workspace } = await params;
  const { ids } = await searchParams;
  const t = await getTranslations("linkPages");
  const requested = (Array.isArray(ids) ? ids : ids ? [ids] : [])
    .filter((id) => /^[a-f0-9]{24}$/.test(id))
    .slice(0, 500);
  if (!requested.length) redirect(`/${workspace}/links`);
  const ctx = await serviceContext(workspace);
  const links = (
    await Promise.all(requested.map((id) => getLink(ctx, id)))
  ).filter((link) => link !== null);
  const allowed = links.filter((link) =>
    can(ctx.actor, "resource.delete", {
      createdBy: link.createdBy ?? undefined,
    }),
  );
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: t("delete.titleMany", { count: allowed.length }) },
      ]}
      title={t("delete.titleMany", { count: allowed.length })}
      description={
        allowed.length < links.length
          ? t("delete.notAllowed")
          : t("delete.description")
      }
      width="form"
    >
      {allowed.length ? (
        <DeleteLinks
          workspace={workspace}
          ids={allowed.map((link) => link.id)}
          items={allowed.map(
            (link) => `${link.domain}/${link.key} → ${link.url}`,
          )}
          cancelHref={`/${workspace}/links`}
        />
      ) : null}
    </Page>
  );
}
