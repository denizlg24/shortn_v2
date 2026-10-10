"use client";

import type { PlanId } from "@shortn/billing";
import type { CampaignView } from "@shortn/core";
import {
  announce,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  formatDate,
  formatNumber,
  isTypingTarget,
} from "@shortn/ui";
import { Ellipsis, Lock, PanelRight, Plus, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import { deleteCampaignAction } from "@/server/actions/campaigns";
import { settle } from "../editor/action-error";
import { PlanGate } from "../plan-gate";
import { ConfirmDialog } from "../settings/confirm-dialog";
import { PageHeader } from "../shell/page-header";
import { useCampaignError } from "./campaign-errors";

const goSequenceMs = 1200;

export const campaignHref = (workspace: string, id: string) =>
  `/${workspace}/campaigns/${id}` as const;

/** Free and Basic workspaces see what campaigns are and how to get them. */
export function CampaignsGate({ plan }: { plan: PlanId }) {
  const t = useTranslations("campaigns");
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="text-body font-medium text-pretty">{t("gated.title")}</p>
        <p className="text-small text-pretty text-fg-muted">
          {t("gated.body")}
        </p>
        <PlanGate feature="campaigns" plan={plan} className="mt-1 text-left" />
      </div>
    </>
  );
}

export function CampaignsList({
  workspace,
  canEdit,
  campaigns,
}: {
  workspace: string;
  canEdit: boolean;
  campaigns: CampaignView[];
}) {
  const t = useTranslations("campaigns");
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const toError = useCampaignError();
  const [deleting, setDeleting] = useState<CampaignView | null>(null);
  const [confirming, setConfirming] = useState(false);
  const goPressedAt = useRef(0);

  const newHref = `/${workspace}/campaigns/new` as const;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        isTypingTarget(event.target) ||
        (event.target instanceof Element &&
          event.target.closest('[role="dialog"], [role="menu"]'))
      )
        return;
      const key = event.key.toLowerCase();
      const afterGo = Date.now() - goPressedAt.current < goSequenceMs;
      goPressedAt.current = key === "g" ? Date.now() : 0;
      if (!afterGo && key === "c" && canEdit) {
        event.preventDefault();
        router.push(newHref);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canEdit, router, newHref]);

  const confirmDelete = async (): Promise<string | null> => {
    if (!deleting) return null;
    const result = await settle(deleteCampaignAction(workspace, deleting.id));
    if (!result.ok) return toError(result).message;
    setConfirming(false);
    announce(t("delete.done", { title: deleting.title }));
    router.refresh();
    return null;
  };

  const createAction = (content: ReactNode) =>
    canEdit ? (
      <Button asChild variant="primary">
        <Link href={newHref}>{content}</Link>
      </Button>
    ) : (
      <Button variant="primary" disabledReason={t("viewerReason")}>
        {content}
      </Button>
    );
  const head =
    "h-header-row px-cell text-left text-meta font-medium whitespace-nowrap text-fg-muted";
  const cell = "h-row px-cell align-middle";

  return (
    <>
      <PageHeader
        title={t("title")}
        count={formatNumber(campaigns.length, intlLocale)}
      >
        <div className="ml-auto flex items-center gap-3">
          {canEdit ? null : (
            <span className="inline-flex items-center gap-1.5 text-small whitespace-nowrap text-fg-muted">
              <Lock aria-hidden className="size-3.5" />
              {t("viewOnly")}
            </span>
          )}
          {createAction(
            <>
              <Plus aria-hidden />
              <span className="max-sm:sr-only">{t("create")}</span>
            </>,
          )}
        </div>
      </PageHeader>

      {campaigns.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={canEdit ? t("empty.body") : t("empty.bodyViewer")}
          action={createAction(t("create"))}
        />
      ) : (
        <table className="w-full table-fixed border-collapse text-small">
          <thead className="border-b border-line bg-bg-subtle">
            <tr>
              <th scope="col" className={cn(head, "pl-gutter")}>
                {t("columns.campaign")}
              </th>
              <th scope="col" className={cn(head, "w-24 text-right")}>
                {t("columns.links")}
              </th>
              <th scope="col" className={cn(head, "w-36 max-sm:hidden")}>
                {t("columns.created")}
              </th>
              <th
                scope="col"
                className={cn(
                  head,
                  "w-[calc(var(--spacing-gutter)+32px)] pr-gutter",
                )}
              >
                <span className="sr-only">{t("columns.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr
                key={campaign.id}
                className="group relative border-b border-line hover:bg-bg-subtle has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-signal"
              >
                <td className={cn(cell, "pl-gutter")}>
                  <div className="flex min-w-0 items-baseline gap-3">
                    <Link
                      href={campaignHref(workspace, campaign.id)}
                      className="shrink-0 truncate font-medium outline-none after:absolute after:inset-0 after:content-[''] max-sm:shrink"
                    >
                      {campaign.title}
                    </Link>
                    {campaign.description ? (
                      <span className="min-w-0 truncate text-fg-muted max-sm:hidden">
                        {campaign.description}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className={cn(cell, "text-right font-mono tabular-nums")}>
                  {formatNumber(campaign.linkCount, intlLocale)}
                </td>
                <td
                  className={cn(
                    cell,
                    "font-mono text-fg-muted tabular-nums max-sm:hidden",
                  )}
                >
                  {formatDate(new Date(campaign.createdAt), intlLocale)}
                </td>
                <td className={cn(cell, "pr-gutter text-right")}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("actions.label", {
                          title: campaign.title,
                        })}
                        className="relative z-10"
                      >
                        <Ellipsis aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        icon={<PanelRight aria-hidden />}
                        onSelect={() =>
                          router.push(campaignHref(workspace, campaign.id))
                        }
                      >
                        {t("actions.open")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        icon={<Trash aria-hidden />}
                        tone="danger"
                        disabled={!canEdit}
                        onSelect={() => {
                          setDeleting(campaign);
                          setConfirming(true);
                        }}
                      >
                        {t("actions.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("delete.title", { title: deleting?.title ?? "" })}
        description={t("delete.body", { count: deleting?.linkCount ?? 0 })}
        confirmLabel={t("delete.confirm")}
        onConfirm={confirmDelete}
      />
    </>
  );
}
