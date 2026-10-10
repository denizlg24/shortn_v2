"use client";

import type { QrView } from "@shortn/core";
import {
  announce,
  Button,
  Checkbox,
  cn,
  copyText,
  Destination,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  formatDate,
  formatNumber,
  Input,
  isTypingTarget,
  KeyboardHint,
  TagChips,
} from "@shortn/ui";
import {
  ChartColumn,
  Copy,
  Ellipsis,
  LayoutGrid,
  List,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import { deleteQrsAction, listQrsAction } from "@/server/actions/qr";
import { Segmented } from "../analytics/segmented";
import { settle } from "../editor/action-error";
import { ConfirmDialog } from "../settings/confirm-dialog";
import { PageHeader } from "../shell/page-header";
import { useQrError } from "./qr-errors";
import { QrImage } from "./qr-image";
import { stylingOptions } from "./qr-render";
import type { QrViewMode } from "./qr-tabs";

const searchDebounceMs = 250;
const listCap = 500;
const goSequenceMs = 1200;

const detailHref = (workspace: string, id: string) =>
  `/${workspace}/qr/${id}` as const;
const editHref = (workspace: string, id: string) =>
  `/${workspace}/qr/${id}/edit` as const;

export function QrDesk({
  workspace,
  canEdit,
  initialQrs,
  initialView,
}: {
  workspace: string;
  canEdit: boolean;
  initialQrs: QrView[];
  initialView: QrViewMode;
}) {
  const t = useTranslations("qr");
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const toError = useQrError();
  const [items, setItems] = useState(initialQrs);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ready" | "searching" | "error">(
    "ready",
  );
  const [view, setView] = useState(initialView);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const debounceRef = useRef<number | undefined>(undefined);
  const goPressedAt = useRef(0);

  useEffect(() => () => window.clearTimeout(debounceRef.current), []);

  const selection = useMemo(
    () => items.filter((qr) => selected.has(qr.id)),
    [items, selected],
  );
  const selecting = selection.length > 0;

  const runSearch = useCallback(
    (term: string) => {
      const request = ++requestRef.current;
      setStatus("searching");
      listQrsAction(workspace, term || undefined).then(
        (result) => {
          if (request !== requestRef.current) return;
          setItems(result);
          setStatus("ready");
        },
        () => {
          if (request === requestRef.current) setStatus("error");
        },
      );
    },
    [workspace],
  );

  const changeQuery = (value: string) => {
    setQuery(value);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(
      () => runSearch(value.trim()),
      searchDebounceMs,
    );
  };

  const changeView = (next: QrViewMode) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "grid") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const newHref = `/${workspace}/qr/new` as const;
  const openCreate = useCallback(() => {
    if (canEdit) router.push(newHref);
  }, [canEdit, router, newHref]);

  useEffect(() => {
    const insideOverlay = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(target.closest('[role="dialog"], [role="menu"]'));
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target) ||
        insideOverlay(event.target)
      )
        return;
      const key = event.key.toLowerCase();
      const afterGo = Date.now() - goPressedAt.current < goSequenceMs;
      goPressedAt.current = key === "g" ? Date.now() : 0;
      if (afterGo) return;
      if (key === "c" && !event.shiftKey && canEdit) {
        event.preventDefault();
        openCreate();
      } else if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (key === "x" && canEdit && event.target instanceof Element) {
        const id =
          event.target.closest<HTMLElement>("[data-qr-id]")?.dataset.qrId;
        if (!id) return;
        event.preventDefault();
        toggle(id);
      } else if (event.key === "Escape" && selecting) {
        event.preventDefault();
        clearSelection();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canEdit, openCreate, selecting, clearSelection]);

  const copyShortLink = (qr: QrView) => {
    void copyText(qr.shortUrl).then((ok) =>
      announce(
        ok
          ? t("copied", { link: qr.shortUrl.replace(/^https?:\/\//, "") })
          : t("errors.copyFailed"),
      ),
    );
  };

  const askDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setConfirming(true);
  };

  const confirmDelete = async (): Promise<string | null> => {
    const result = await settle(deleteQrsAction(workspace, deleteIds));
    if (!result.ok) return toError(result).message;
    const deleted = new Set(result.data.deleted);
    setItems((current) => current.filter((qr) => !deleted.has(qr.id)));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of deleted) next.delete(id);
      return next;
    });
    setConfirming(false);
    announce(t("delete.done", { count: deleted.size }));
    router.refresh();
    return null;
  };

  const actions = (qr: QrView) => (
    <>
      <DropdownMenuItem
        icon={<Pencil aria-hidden />}
        onSelect={() => router.push(editHref(workspace, qr.id))}
      >
        {t("actions.edit")}
      </DropdownMenuItem>
      <DropdownMenuItem
        icon={<Copy aria-hidden />}
        onSelect={() => copyShortLink(qr)}
      >
        {t("actions.copy")}
      </DropdownMenuItem>
      <DropdownMenuItem
        icon={<ChartColumn aria-hidden />}
        onSelect={() => router.push(detailHref(workspace, qr.id))}
      >
        {t("actions.scans")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        icon={<Trash aria-hidden />}
        tone="danger"
        disabled={!canEdit}
        onSelect={() => askDelete([qr.id])}
      >
        {t("actions.delete")}
      </DropdownMenuItem>
    </>
  );

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
  const count =
    status === "ready"
      ? `${formatNumber(items.length, intlLocale)}${items.length >= listCap ? "+" : ""}`
      : undefined;
  const filtering = query.trim() !== "";
  const deleteCount = deleteIds.length;

  return (
    <>
      <PageHeader
        title={t("title")}
        count={count}
        className="flex-wrap gap-y-2 py-2.5"
      >
        <Input
          ref={searchRef}
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          maxLength={200}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              changeQuery("");
            } else if (event.key === "Escape") event.currentTarget.blur();
          }}
          leading={<Search aria-hidden />}
          trailing={
            query ? (
              <button
                type="button"
                aria-label={t("clearSearch")}
                onClick={() => changeQuery("")}
                className="-mr-1 grid size-5 cursor-pointer place-items-center rounded-chip hover:text-fg"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            ) : (
              <KeyboardHint keys="/" className="max-md:hidden" />
            )
          }
          frameClassName="w-60 max-md:order-last max-md:w-full"
        />
        <div className="ml-auto flex items-center gap-3">
          {canEdit ? null : (
            <span className="inline-flex items-center gap-1.5 text-small whitespace-nowrap text-fg-muted">
              <Lock aria-hidden className="size-3.5" />
              {t("viewOnly")}
            </span>
          )}
          <Segmented
            label={t("view.label")}
            value={view}
            onValueChange={changeView}
            options={[
              {
                value: "grid",
                label: <LayoutGrid aria-hidden className="size-4" />,
                ariaLabel: t("view.grid"),
              },
              {
                value: "list",
                label: <List aria-hidden className="size-4" />,
                ariaLabel: t("view.list"),
              },
            ]}
          />
          {createAction(
            <>
              <Plus aria-hidden />
              <span className="max-sm:sr-only">{t("create")}</span>
              <KeyboardHint
                keys="c"
                tone="inverse"
                className="-mr-1 ml-0.5 max-sm:hidden"
              />
            </>,
          )}
        </div>
      </PageHeader>

      {status === "error" ? (
        <EmptyState
          tone="danger"
          title={t("error.title")}
          description={t("error.body")}
          action={
            <Button onClick={() => runSearch(query.trim())}>
              {t("retry")}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        filtering ? (
          <EmptyState
            title={t("empty.noMatch", { query: query.trim() })}
            description={t("empty.noMatchBody")}
            action={
              <Button onClick={() => changeQuery("")}>
                {t("empty.clear")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={t("empty.firstTitle")}
            description={
              canEdit ? t("empty.firstBody") : t("empty.firstBodyViewer")
            }
            action={createAction(t("create"))}
          />
        )
      ) : (
        <div
          aria-busy={status === "searching" || undefined}
          className={cn(
            "transition-opacity duration-(--motion-fast)",
            status === "searching" && "opacity-60",
          )}
        >
          {view === "grid" ? (
            <QrGrid
              workspace={workspace}
              items={items}
              selected={selected}
              selecting={selecting}
              canSelect={canEdit}
              onToggle={toggle}
              actions={actions}
            />
          ) : (
            <QrList
              workspace={workspace}
              items={items}
              selected={selected}
              canSelect={canEdit}
              onToggle={toggle}
              onToggleAll={(all) =>
                setSelected(all ? new Set(items.map((qr) => qr.id)) : new Set())
              }
              actions={actions}
              intlLocale={intlLocale}
            />
          )}
        </div>
      )}

      {selecting ? (
        <div
          role="toolbar"
          aria-label={t("bulk.label")}
          className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-overlay border border-line bg-overlay py-1.5 pr-1.5 pl-3.5 shadow-overlay animate-overlay-in max-md:bottom-18 md:ml-[calc(var(--spacing-rail)/2)] xl:ml-[calc(var(--spacing-sidebar)/2)]"
        >
          <span
            aria-live="polite"
            className="mr-2 text-small font-medium whitespace-nowrap tabular-nums"
          >
            {t("bulk.selected", { count: selection.length })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            tooltip={t("bulk.clear")}
            shortcut="esc"
            onClick={clearSelection}
          >
            {t("bulk.clear")}
          </Button>
          <Button
            variant="dangerGhost"
            size="sm"
            onClick={() => askDelete(selection.map((qr) => qr.id))}
          >
            <Trash aria-hidden />
            {t("bulk.delete")}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("delete.title", { count: deleteCount })}
        description={t("delete.body")}
        confirmLabel={t("delete.confirm", { count: deleteCount })}
        onConfirm={confirmDelete}
      />
    </>
  );
}

type Actions = (qr: QrView) => ReactNode;

function RowMenu({
  qr,
  actions,
  className,
}: {
  qr: QrView;
  actions: Actions;
  className?: string;
}) {
  const t = useTranslations("qr");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("actions.label", { title: qr.title })}
          className={className}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {actions(qr)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const revealOnCell =
  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 aria-expanded:opacity-100";

function QrGrid({
  workspace,
  items,
  selected,
  selecting,
  canSelect,
  onToggle,
  actions,
}: {
  workspace: string;
  items: QrView[];
  selected: ReadonlySet<string>;
  selecting: boolean;
  canSelect: boolean;
  onToggle: (id: string) => void;
  actions: Actions;
}) {
  return (
    <div className="overflow-hidden">
      <ul className="-mr-px grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
        {items.map((qr) => (
          <QrCell
            key={qr.id}
            workspace={workspace}
            qr={qr}
            checked={selected.has(qr.id)}
            selecting={selecting}
            canSelect={canSelect}
            onToggle={onToggle}
            actions={actions}
          />
        ))}
      </ul>
    </div>
  );
}

function QrCell({
  workspace,
  qr,
  checked,
  selecting,
  canSelect,
  onToggle,
  actions,
}: {
  workspace: string;
  qr: QrView;
  checked: boolean;
  selecting: boolean;
  canSelect: boolean;
  onToggle: (id: string) => void;
  actions: Actions;
}) {
  const t = useTranslations("qr");
  const intlLocale = useIntlLocale();
  const options = useMemo(
    () => stylingOptions(qr.design, qr.shortUrl),
    [qr.design, qr.shortUrl],
  );
  return (
    <li
      data-qr-id={qr.id}
      data-selected={checked || undefined}
      className={cn(
        "group relative flex min-w-0 flex-col gap-3 border-r border-b border-line px-4 pt-5 pb-3.5",
        "hover:bg-bg-subtle data-selected:bg-bg-muted",
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-signal",
      )}
    >
      <QrImage options={options} size={120} alt="" lazy className="mx-auto" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={detailHref(workspace, qr.id)}
          className="truncate text-small font-medium outline-none after:absolute after:inset-0 after:content-['']"
        >
          {qr.title || qr.key}
        </Link>
        <div className="flex min-w-0 items-baseline justify-between gap-2 text-meta text-fg-muted">
          <span className="min-w-0 truncate font-mono">{qr.key}</span>
          <span className="shrink-0 font-mono whitespace-nowrap tabular-nums">
            {t("scans", {
              count: qr.scans,
              formatted: formatNumber(qr.scans, intlLocale),
            })}
          </span>
        </div>
      </div>
      {canSelect ? (
        <Checkbox
          checked={checked}
          onCheckedChange={() => onToggle(qr.id)}
          aria-label={t("select", { title: qr.title || qr.key })}
          className={cn(
            "absolute top-3 left-3 z-10",
            !checked && !selecting && revealOnCell,
          )}
        />
      ) : null}
      <RowMenu
        qr={qr}
        actions={actions}
        className={cn("absolute top-2 right-2 z-10", revealOnCell)}
      />
    </li>
  );
}

function QrList({
  workspace,
  items,
  selected,
  canSelect,
  onToggle,
  onToggleAll,
  actions,
  intlLocale,
}: {
  workspace: string;
  items: QrView[];
  selected: ReadonlySet<string>;
  canSelect: boolean;
  onToggle: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  actions: Actions;
  intlLocale: string;
}) {
  const t = useTranslations("qr");
  const selectedCount = items.filter((qr) => selected.has(qr.id)).length;
  const head =
    "h-header-row px-cell text-left text-meta font-medium whitespace-nowrap text-fg-muted";
  return (
    <table className="w-full table-fixed border-collapse text-small">
      <thead className="border-b border-line bg-bg-subtle">
        <tr>
          <th
            scope="col"
            className={cn(
              head,
              "w-[calc(var(--spacing-gutter)+28px)] pl-gutter",
            )}
          >
            {canSelect ? (
              <Checkbox
                checked={
                  selectedCount === 0
                    ? false
                    : selectedCount === items.length
                      ? true
                      : "indeterminate"
                }
                onCheckedChange={() => onToggleAll(selectedCount === 0)}
                aria-label={t("selectAll")}
              />
            ) : (
              <span className="sr-only">{t("columns.select")}</span>
            )}
          </th>
          <th scope="col" className={head}>
            {t("columns.code")}
          </th>
          <th scope="col" className={cn(head, "w-40 max-md:hidden")}>
            {t("columns.link")}
          </th>
          <th scope="col" className={cn(head, "max-lg:hidden")}>
            {t("columns.destination")}
          </th>
          <th scope="col" className={cn(head, "w-24 text-right")}>
            {t("columns.scans")}
          </th>
          <th scope="col" className={cn(head, "w-32 max-md:hidden")}>
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
        {items.map((qr) => (
          <QrListRow
            key={qr.id}
            workspace={workspace}
            qr={qr}
            checked={selected.has(qr.id)}
            canSelect={canSelect}
            onToggle={onToggle}
            actions={actions}
            intlLocale={intlLocale}
          />
        ))}
      </tbody>
    </table>
  );
}

function QrListRow({
  workspace,
  qr,
  checked,
  canSelect,
  onToggle,
  actions,
  intlLocale,
}: {
  workspace: string;
  qr: QrView;
  checked: boolean;
  canSelect: boolean;
  onToggle: (id: string) => void;
  actions: Actions;
  intlLocale: string;
}) {
  const t = useTranslations("qr");
  const options = useMemo(
    () => stylingOptions(qr.design, qr.shortUrl),
    [qr.design, qr.shortUrl],
  );
  const cell = "h-13 px-cell align-middle";
  return (
    <tr
      data-qr-id={qr.id}
      data-selected={checked || undefined}
      className="group relative border-b border-line hover:bg-bg-subtle data-selected:bg-bg-muted has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-signal"
    >
      <td className={cn(cell, "pl-gutter")}>
        {canSelect ? (
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggle(qr.id)}
            aria-label={t("select", { title: qr.title || qr.key })}
            className="relative z-10"
          />
        ) : null}
      </td>
      <td className={cell}>
        <div className="flex min-w-0 items-center gap-3">
          <QrImage options={options} size={32} alt="" lazy />
          <div className="flex min-w-0 flex-col">
            <Link
              href={detailHref(workspace, qr.id)}
              className="truncate font-medium outline-none after:absolute after:inset-0 after:content-['']"
            >
              {qr.title || qr.key}
            </Link>
            {qr.tags.length ? (
              <TagChips tags={qr.tags.map((tag) => tag.name)} max={3} />
            ) : null}
          </div>
        </div>
      </td>
      <td className={cn(cell, "font-mono text-fg-muted max-md:hidden")}>
        <span className="block truncate">{qr.key}</span>
      </td>
      <td className={cn(cell, "max-lg:hidden")}>
        <Destination url={qr.url} className="min-w-0" />
      </td>
      <td className={cn(cell, "text-right font-mono tabular-nums")}>
        {formatNumber(qr.scans, intlLocale)}
      </td>
      <td
        className={cn(
          cell,
          "font-mono text-fg-muted tabular-nums max-md:hidden",
        )}
      >
        {formatDate(new Date(qr.createdAt), intlLocale)}
      </td>
      <td className={cn(cell, "pr-gutter text-right")}>
        <RowMenu qr={qr} actions={actions} className="relative z-10" />
      </td>
    </tr>
  );
}
