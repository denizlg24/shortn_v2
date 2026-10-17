import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { can } from "@shortn/core/authz";
import { buttonVariants } from "@shortn/ui";
import { Page } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { ImportUpload } from "@/components/imports/upload";
import { serviceContext } from "@/server/context";
import { importStore } from "@/server/imports";

export async function generateMetadata() {
  return { title: (await getTranslations("imports"))("new") };
}
export default async function NewImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace } = await params,
    query = await searchParams;
  const [ctx, t] = await Promise.all([
    serviceContext(workspace),
    getTranslations("imports"),
  ]);
  const kind = query.kind === "qr" ? "qr" : "links",
    enabled = Boolean(importStore());
  return (
    <Page
      crumbs={[
        { label: t("title"), href: `/${workspace}/imports` },
        { label: t("new") },
      ]}
      title={t("new")}
      description={t("description")}
      width="form"
    >
      {enabled && can(ctx.actor, "resource.create") ? (
        <ImportUpload workspace={workspace} kind={kind} />
      ) : (
        <>
          <Notice tone="warning">
            {t(enabled ? "errors.forbidden" : "disabled")}
          </Notice>
          <Link
            href={`/${workspace}/${kind}`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t("back")}
          </Link>
        </>
      )}
    </Page>
  );
}
