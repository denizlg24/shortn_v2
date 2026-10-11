import { getQr } from "@shortn/core";
import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { DeleteQrs } from "@/components/qr/qr-delete";
import { serviceContext } from "@/server/context";
import { objectIds } from "@/server/form-data";
import { qrName } from "@/server/qr-page";

export async function generateMetadata() {
  const t = await getTranslations("qr.deletePage");
  return { title: t("titleSelected") };
}

// Bulk delete: the list's checkboxes submit here as ?ids=…
export default async function DeleteSelectedQrsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/qr/delete">) {
  const { workspace } = await params;
  const { ids } = await searchParams;
  const t = await getTranslations("qr");
  const requested = objectIds(Array.isArray(ids) ? ids : ids ? [ids] : []);
  if (!requested.length) redirect(`/${workspace}/qr`);
  const ctx = await serviceContext(workspace);
  const qrs = (await Promise.all(requested.map((id) => getQr(ctx, id)))).filter(
    (qr) => qr !== null,
  );
  const allowed = qrs.filter((qr) =>
    can(ctx.actor, "resource.delete", { createdBy: qr.createdBy ?? undefined }),
  );
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/qr` },
        { label: t("deletePage.title", { count: allowed.length }) },
      ]}
      title={t("deletePage.title", { count: allowed.length })}
      description={
        allowed.length < qrs.length
          ? t("deletePage.notAllowed")
          : t("deletePage.description")
      }
      width="form"
    >
      {allowed.length ? (
        <DeleteQrs
          workspace={workspace}
          ids={allowed.map((qr) => qr.id)}
          items={allowed.map(
            (qr) =>
              `${qrName(qr)} · ${qr.shortUrl.replace(/^https?:\/\//, "")} → ${qr.url}`,
          )}
          attached={allowed.some((qr) => Boolean(qr.attachedLinkKey))}
          cancelHref={`/${workspace}/qr`}
        />
      ) : null}
    </Page>
  );
}
