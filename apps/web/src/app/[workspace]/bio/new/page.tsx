import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { BioCreateForm } from "@/components/bio/bio-create-form";
import { env } from "@/server/env";
import { billingOverview } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bio.new");
  return { title: t("title") };
}

export default async function NewBioPage({
  params,
}: PageProps<"/[workspace]/bio/new">) {
  const { workspace: slug } = await params;
  const { actor } = await requireWorkspace(slug);
  if (!can(actor, "resource.create")) redirect(`/${slug}/bio`);
  const overview = await billingOverview(slug);
  return (
    <BioCreateForm
      workspace={slug}
      host={new URL(env().PUBLIC_ORIGIN).host}
      used={overview.usage.bioPages}
      limit={overview.limits.bioPages}
    />
  );
}
