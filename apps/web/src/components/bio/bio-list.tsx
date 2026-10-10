"use client";

import type { BioSummary } from "@shortn/core";
import {
  announce,
  Button,
  buttonVariants,
  cn,
  copyText,
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
import {
  Copy,
  Ellipsis,
  ExternalLink,
  Lock,
  Pencil,
  Plus,
  Trash,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import { deleteBioPageAction } from "@/server/actions/bio";
import { CopyButton } from "../editor/copy-button";
import { settle } from "../editor/action-error";
import { ConfirmDialog } from "../settings/confirm-dialog";
import { PageHeader } from "../shell/page-header";
import { useBioError } from "./bio-errors";
import { publicPath } from "./bio-rules";

const goSequenceMs = 1200;

export function BioList({
  workspace,
  pages,
  publicOrigin,
  limit,
  canEdit,
}: {
  workspace: string;
  pages: BioSummary[];
  publicOrigin: string;
  /** Pages the plan allows in total; null when unlimited. */
  limit: number | null;
  canEdit: boolean;
}) {
  const t = useTranslations("bio");
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const toError = useBioError();
  const [deleting, setDeleting] = useState<BioSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const goPressedAt = useRef(0);
  const newHref = `/${workspace}/bio/new` as const;

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

  const urlOf = (slug: string) => `${publicOrigin}${publicPath(slug)}`;
  const shown = (slug: string) => urlOf(slug).replace(/^https?:\/\//, "");

  const confirmDelete = async (): Promise<string | null> => {
    if (!deleting) return null;
    const result = await settle(deleteBioPageAction(workspace, deleting.id));
    if (!result.ok) return toError(result).message;
    setConfirming(false);
    announce(t("delete.done", { slug: deleting.slug }));
    router.refresh();
    return null;
  };

  const count =
    limit === null
      ? formatNumber(pages.length, intlLocale)
      : t("count", {
          used: formatNumber(pages.length, intlLocale),
          limit: formatNumber(limit, intlLocale),
        });
  const createButton = (children: ReactNode, className?: string) =>
    canEdit ? (
      <Link
        href={newHref}
        className={cn(buttonVariants({ variant: "primary" }), className)}
      >
        {children}
      </Link>
    ) : (
      <Button
        variant="primary"
        disabledReason={t("viewerReason")}
        className={className}
      >
        {children}
      </Button>
    );
  const head =
    "h-header-row px-cell text-left text-meta font-medium whitespace-nowrap text-fg-muted";
  const cell = "h-13 px-cell align-middle";

  return (
    <>
      <PageHeader title={t("title")} count={count}>
        <div className="ml-auto flex items-center gap-3">
          {canEdit ? null : (
            <span className="inline-flex items-center gap-1.5 text-small whitespace-nowrap text-fg-muted">
              <Lock aria-hidden className="size-3.5" />
              {t("viewOnly")}
            </span>
          )}
          {createButton(
            <>
              <Plus aria-hidden />
              <span className="max-sm:sr-only">{t("create")}</span>
            </>,
          )}
        </div>
      </PageHeader>

      {pages.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={canEdit ? t("empty.body") : t("empty.bodyViewer")}
          action={createButton(t("create"))}
        />
      ) : (
        <table className="w-full table-fixed border-collapse text-small">
          <thead className="border-b border-line bg-bg-subtle">
            <tr>
              <th scope="col" className={cn(head, "pl-gutter")}>
                {t("columns.page")}
              </th>
              <th scope="col" className={cn(head, "w-[34%] max-md:hidden")}>
                {t("columns.url")}
              </th>
              <th scope="col" className={cn(head, "w-20 text-right")}>
                {t("columns.links")}
              </th>
              <th scope="col" className={cn(head, "w-32 max-sm:hidden")}>
                {t("columns.updated")}
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
            {pages.map((page) => (
              <tr
                key={page.id}
                className="group relative border-b border-line hover:bg-bg-subtle has-[a[data-row]:focus-visible]:outline-2 has-[a[data-row]:focus-visible]:-outline-offset-2 has-[a[data-row]:focus-visible]:outline-signal"
              >
                <td className={cn(cell, "pl-gutter")}>
                  <div className="flex min-w-0 items-center gap-3">
                    <PageAvatar page={page} />
                    <div className="flex min-w-0 flex-col">
                      <Link
                        data-row
                        href={`/${workspace}/bio/${page.id}`}
                        className="truncate font-medium outline-none after:absolute after:inset-0 after:content-['']"
                      >
                        {page.title || page.slug}
                      </Link>
                      <span className="truncate font-mono text-meta text-fg-muted md:hidden">
                        {shown(page.slug)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className={cn(cell, "max-md:hidden")}>
                  <div className="relative z-10 flex min-w-0 items-center gap-0.5">
                    <span className="min-w-0 truncate font-mono text-fg-muted">
                      {shown(page.slug)}
                    </span>
                    <CopyButton text={urlOf(page.slug)} label={t("copyUrl")} />
                    <a
                      href={urlOf(page.slug)}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={t("openPageNamed", { slug: page.slug })}
                      title={t("openPage")}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "icon-sm",
                      })}
                    >
                      <ExternalLink aria-hidden />
                    </a>
                  </div>
                </td>
                <td className={cn(cell, "text-right font-mono tabular-nums")}>
                  {formatNumber(page.linkCount, intlLocale)}
                </td>
                <td
                  className={cn(
                    cell,
                    "font-mono text-fg-muted tabular-nums max-sm:hidden",
                  )}
                >
                  {formatDate(new Date(page.updatedAt), intlLocale)}
                </td>
                <td className={cn(cell, "pr-gutter text-right")}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("actions.label", { slug: page.slug })}
                        className="relative z-10"
                      >
                        <Ellipsis aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        icon={<Pencil aria-hidden />}
                        onSelect={() =>
                          router.push(`/${workspace}/bio/${page.id}`)
                        }
                      >
                        {t("actions.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        icon={<Copy aria-hidden />}
                        onSelect={() =>
                          void copyText(urlOf(page.slug)).then((ok) =>
                            announce(ok ? t("copied") : t("errors.copyFailed")),
                          )
                        }
                      >
                        {t("copyUrl")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        icon={<ExternalLink aria-hidden />}
                        onSelect={() =>
                          window.open(urlOf(page.slug), "_blank", "noopener")
                        }
                      >
                        {t("openPage")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        icon={<Trash aria-hidden />}
                        tone="danger"
                        disabled={!canEdit}
                        onSelect={() => {
                          setDeleting(page);
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
        title={t("delete.title", { slug: deleting?.slug ?? "" })}
        description={t("delete.body", {
          url: deleting ? shown(deleting.slug) : "",
        })}
        confirmLabel={t("delete.confirm")}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function PageAvatar({ page }: { page: BioSummary }) {
  const [failed, setFailed] = useState(false);
  const initial = (page.title || page.slug).charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-bg-muted text-meta font-medium text-fg-muted"
    >
      {page.avatarUrl && !failed ? (
        <img
          src={page.avatarUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}
