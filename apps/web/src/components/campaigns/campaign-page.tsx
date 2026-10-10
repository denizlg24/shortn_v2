"use client";

import type { PlanId } from "@shortn/billing";
import type { CampaignView, LinkView } from "@shortn/core";
import {
  announce,
  Button,
  buttonVariants,
  copyText,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  formatNumber,
  LinksTable,
  shortUrl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type LinkRow,
} from "@shortn/ui";
import { ChartColumn, Copy, Ellipsis, Pencil, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import { useUrlTab } from "@/lib/use-url-tab";
import { deleteCampaignAction } from "@/server/actions/campaigns";
import { AnalyticsView } from "../analytics/analytics-view";
import { settle } from "../editor/action-error";
import { ConfirmDialog } from "../settings/confirm-dialog";
import { BreadcrumbTitle } from "../shell/breadcrumb-title";
import { PageHeader } from "../shell/page-header";
import { useCampaignError } from "./campaign-errors";
import { CampaignSummary } from "./campaign-summary";
import { campaignTabs, type CampaignTab } from "./campaign-tabs";
import { UtmBuilder } from "./utm-builder";

const toRow = (link: LinkView): LinkRow => ({
  id: link.id,
  domain: link.domain,
  key: link.key,
  url: link.url,
  tags: link.tags.map((tag) => tag.name),
  clicks: link.clicks,
  trend: [],
  createdAt: link.createdAt,
});

/** The campaign page (12): analytics scoped to it, its links, and the UTM builder with its defaults. */
export function CampaignPage({
  workspace,
  campaign,
  links,
  canEdit,
  exportGate,
  breakdownGate,
  initialTab,
}: {
  workspace: string;
  campaign: CampaignView;
  links: LinkView[];
  canEdit: boolean;
  exportGate: PlanId | null;
  breakdownGate: PlanId | null;
  initialTab: CampaignTab;
}) {
  const t = useTranslations("campaigns");
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const toError = useCampaignError();
  const [tab, setTab] = useUrlTab(campaignTabs, initialTab);
  const [confirming, setConfirming] = useState(false);
  const rows = useMemo(() => links.map(toRow), [links]);
  const linkHref = (id: string) => `/${workspace}/links/${id}` as const;

  const confirmDelete = async (): Promise<string | null> => {
    const result = await settle(deleteCampaignAction(workspace, campaign.id));
    if (!result.ok) return toError(result).message;
    announce(t("delete.done", { title: campaign.title }));
    router.replace(`/${workspace}/campaigns`);
    return null;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={
          <BreadcrumbTitle
            trail={[{ href: `/${workspace}/campaigns`, label: t("title") }]}
          >
            {campaign.title}
          </BreadcrumbTitle>
        }
      >
        <div className="ml-auto flex items-center gap-2">
          {canEdit ? (
            <Link
              href={`/${workspace}/campaigns/${campaign.id}/edit`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <Pencil aria-hidden />
              <span className="max-sm:sr-only">{t("actions.edit")}</span>
            </Link>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                aria-label={t("actions.label", { title: campaign.title })}
              >
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                icon={<Copy aria-hidden />}
                onSelect={() =>
                  void copyText(campaign.title).then((ok) =>
                    announce(ok ? t("copiedParam") : t("errors.copyFailed")),
                  )
                }
              >
                {t("actions.copyParam")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<Trash aria-hidden />}
                tone="danger"
                disabled={!canEdit}
                onSelect={() => setConfirming(true)}
              >
                {t("actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageHeader>

      <CampaignSummary
        workspace={workspace}
        campaign={campaign}
        canEdit={canEdit}
      />

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="shrink-0 px-gutter">
          <TabsTrigger value="analytics">{t("tabs.analytics")}</TabsTrigger>
          <TabsTrigger value="links">
            {t("tabs.links")}
            <span className="font-mono text-meta text-fg-subtle tabular-nums">
              {formatNumber(links.length, intlLocale)}
            </span>
          </TabsTrigger>
          <TabsTrigger value="builder">{t("tabs.builder")}</TabsTrigger>
        </TabsList>

        <TabsContent
          value="analytics"
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <AnalyticsView
            embedded
            workspace={workspace}
            scope={{ type: "campaign", id: campaign.id }}
            title={t("tabs.analytics")}
            breakdownGate={breakdownGate}
            csvExport={{ params: { campaign: campaign.id }, gate: exportGate }}
          />
        </TabsContent>

        <TabsContent value="links" className="flex min-h-0 flex-1 flex-col">
          <LinksTable
            label={t("tabs.links")}
            links={rows}
            compactColumns
            onOpen={(row, intent) =>
              router.push(
                intent === "edit"
                  ? `/${workspace}/links/${row.id}/edit`
                  : linkHref(row.id),
              )
            }
            bulkActionsLabel={t("links.bulk")}
            renderBulkActions={(selected) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void copyText(
                    selected
                      .map((row) => shortUrl(row.domain, row.key))
                      .join("\n"),
                  ).then((ok) =>
                    announce(
                      ok
                        ? t("links.copied", { count: selected.length })
                        : t("errors.copyFailed"),
                    ),
                  )
                }
              >
                <Copy aria-hidden />
                {t("links.copy")}
              </Button>
            )}
            renderRowActions={(row) => (
              <>
                <DropdownMenuItem
                  icon={<ChartColumn aria-hidden />}
                  shortcut="enter"
                  onSelect={() => router.push(linkHref(row.id))}
                >
                  {t("links.open")}
                </DropdownMenuItem>
              </>
            )}
            emptyState={
              <EmptyState
                title={t("links.emptyTitle")}
                description={t("links.emptyBody")}
                action={
                  <Button onClick={() => setTab("builder")}>
                    {t("links.openBuilder")}
                  </Button>
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="builder" className="min-h-0 flex-1 overflow-y-auto">
          <UtmBuilder
            workspace={workspace}
            campaign={campaign}
            links={links}
            canEdit={canEdit}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("delete.title", { title: campaign.title })}
        description={t("delete.body", { count: campaign.linkCount })}
        confirmLabel={t("delete.confirm")}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
