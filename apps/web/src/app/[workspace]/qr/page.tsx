import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { QrDesk } from "@/components/qr/qr-desk";
import { qrViews } from "@/components/qr/qr-tabs";
import { tabFrom } from "@/lib/tabs";
import { listQrsAction } from "@/server/actions/qr";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("qr") };
}

export default async function QrPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/qr">) {
  const { workspace: slug } = await params;
  const { view } = await searchParams;
  const { actor } = await requireWorkspace(slug);
  const qrs = await listQrsAction(slug);
  return (
    <QrDesk
      workspace={slug}
      canEdit={can(actor, "resource.create")}
      initialQrs={qrs}
      initialView={tabFrom(qrViews, view)}
    />
  );
}
