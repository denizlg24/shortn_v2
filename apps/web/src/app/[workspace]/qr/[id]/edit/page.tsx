import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { QrEditor } from "@/components/qr/qr-editor";
import { gateOf } from "@/lib/plan-features";
import { listTagsAction } from "@/server/actions/links";
import { featureAccess } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";
import { loadQr } from "../load";

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/qr/[id]/edit">): Promise<Metadata> {
  const { workspace, id } = await params;
  const [result, t] = await Promise.all([
    loadQr(workspace, id),
    getTranslations("qr.editor"),
  ]);
  return {
    title: result.ok
      ? `${t("title")} · ${result.data.title || result.data.key}`
      : t("title"),
  };
}

export default async function QrEditPage({
  params,
}: PageProps<"/[workspace]/qr/[id]/edit">) {
  const { workspace: slug, id } = await params;
  const { actor } = await requireWorkspace(slug);
  if (!can(actor, "resource.update")) redirect(`/${slug}/qr/${id}`);
  const [result, tags, logo] = await Promise.all([
    loadQr(slug, id),
    listTagsAction(slug),
    featureAccess(slug, "qrLogo"),
  ]);
  if (!result.ok) notFound();
  return (
    <QrEditor
      key={result.data.id}
      workspace={slug}
      qr={result.data}
      tags={tags.map((tag) => tag.name)}
      canEdit
      logoGate={gateOf(logo)}
    />
  );
}
