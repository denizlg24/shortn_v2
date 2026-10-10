import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BioEditor } from "@/components/bio/bio-editor";
import { getBioPageAction } from "@/server/actions/bio";
import { env } from "@/server/env";
import { requireWorkspace } from "@/server/workspace";

const loadPage = cache(getBioPageAction);

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/bio/[id]">): Promise<Metadata> {
  const { workspace, id } = await params;
  const result = await loadPage(workspace, id);
  if (result.ok) return { title: result.data.title || result.data.slug };
  const t = await getTranslations("nav");
  return { title: t("bio") };
}

export default async function BioEditorPage({
  params,
}: PageProps<"/[workspace]/bio/[id]">) {
  const { workspace: slug, id } = await params;
  const { actor } = await requireWorkspace(slug);
  const result = await loadPage(slug, id);
  if (!result.ok) notFound();
  return (
    <BioEditor
      key={`${result.data.id}:${result.data.updatedAt}`}
      workspace={slug}
      bio={result.data}
      linkDomain={env().LINK_DOMAIN}
      publicOrigin={env().PUBLIC_ORIGIN}
      canEdit={can(actor, "resource.update")}
    />
  );
}
