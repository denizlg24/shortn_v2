import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { LinkSummary } from "@/components/links/link-summary";
import { getLinkAction } from "@/server/actions/links";
import { planFeatures } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";

const loadLink = cache(getLinkAction);

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/links/[id]">): Promise<Metadata> {
  const { workspace, id } = await params;
  const result = await loadLink(workspace, id);
  if (result.ok) return { title: `${result.data.domain}/${result.data.key}` };
  const t = await getTranslations("nav");
  return { title: t("links") };
}

export default async function LinkAnalyticsPage({
  params,
}: PageProps<"/[workspace]/links/[id]">) {
  const { workspace: slug, id } = await params;
  const { actor } = await requireWorkspace(slug);
  const [result, features, t] = await Promise.all([
    loadLink(slug, id),
    planFeatures(slug),
    getTranslations("nav"),
  ]);
  if (!result.ok) notFound();
  const link = result.data;

  return (
    <AnalyticsView
      workspace={slug}
      scope={{ type: "link", id: link.id }}
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/${slug}/links`}
            className="shrink-0 text-fg-muted hover:text-fg"
          >
            {t("links")}
          </Link>
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-fg-subtle"
          />
          <span className="truncate">{link.key}</span>
        </span>
      }
      summary={
        <LinkSummary
          workspace={slug}
          link={link}
          canEdit={actor.role !== "viewer"}
        />
      }
      breakdownGate={
        features.analyticsBreakdowns.allowed
          ? null
          : features.analyticsBreakdowns.plan
      }
    />
  );
}
