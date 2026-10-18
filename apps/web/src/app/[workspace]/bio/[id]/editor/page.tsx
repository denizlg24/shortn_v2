import { env } from "@/server/env";
import {
  bioVersions,
  ownedBioDocument,
  publicBioFromDocument,
  readBioDraft,
} from "@shortn/core";
import { loadEntitlements } from "@shortn/billing";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BioEditor } from "@/components/bio/bio-editor";
import { Page } from "@/components/page/page";
import { serviceContext } from "@/server/context";
export default async function BioEditorPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace, id } = await params;
  const ctx = await serviceContext(workspace);
  const draft = await readBioDraft(ctx, id);
  if (!draft) notFound();
  const t = await getTranslations("bio.editor");
  const [document, versions, entitlements] = await Promise.all([
    ownedBioDocument(ctx, id),
    bioVersions(ctx, id),
    loadEntitlements(ctx.db, ctx.workspace._id),
  ]);
  const resolved = await publicBioFromDocument(
    ctx.db,
    { ...document!, publishedContent: draft.content },
    env().PUBLIC_ORIGIN,
    false,
  );
  return (
    <Page
      crumbs={[
        { label: t("pages"), href: `/${workspace}/bio` },
        { label: draft.handle, href: `/${workspace}/bio/${id}` },
        { label: t("titlePage") },
      ]}
      title={t("titlePage")}
    >
      <BioEditor
        workspace={workspace}
        id={id}
        initial={draft.content}
        initialRevision={draft.revision}
        initialHandle={draft.handle}
        versions={versions}
        paid={entitlements.plan !== "free"}
        links={resolved.links}
      />
    </Page>
  );
}
