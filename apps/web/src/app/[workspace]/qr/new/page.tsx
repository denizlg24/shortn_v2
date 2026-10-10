import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { QrCreateForm } from "@/components/qr/qr-create-form";
import { listTagsAction } from "@/server/actions/links";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("qr.createPage");
  return { title: t("title") };
}

export default async function NewQrPage({
  params,
}: PageProps<"/[workspace]/qr/new">) {
  const { workspace: slug } = await params;
  const { actor } = await requireWorkspace(slug);
  if (!can(actor, "resource.create")) redirect(`/${slug}/qr`);
  const tags = await listTagsAction(slug);
  return <QrCreateForm workspace={slug} tags={tags.map((tag) => tag.name)} />;
}
