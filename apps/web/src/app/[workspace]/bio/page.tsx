import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BioList } from "@/components/bio/bio-list";
import { listBioPagesAction } from "@/server/actions/bio";
import { env } from "@/server/env";
import { billingOverview } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("bio") };
}

export default async function BioPage({
  params,
}: PageProps<"/[workspace]/bio">) {
  const { workspace: slug } = await params;
  const { actor } = await requireWorkspace(slug);
  const [pages, overview] = await Promise.all([
    listBioPagesAction(slug),
    billingOverview(slug),
  ]);
  return (
    <BioList
      workspace={slug}
      pages={pages}
      publicOrigin={env().PUBLIC_ORIGIN}
      limit={overview.limits.bioPages}
      canEdit={can(actor, "resource.create")}
    />
  );
}
