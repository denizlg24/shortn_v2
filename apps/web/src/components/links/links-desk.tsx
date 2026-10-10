"use client";

import type { LinkView } from "@shortn/core";
import {
  announce,
  Button,
  cn,
  copyText,
  DropdownMenuItem,
  DropdownMenuSeparator,
  EmptyState,
  FilterBar,
  formatNumber,
  Input,
  isTypingTarget,
  KeyboardHint,
  LinksTable,
  shortUrl,
  type FilterField,
  type LinkRow,
} from "@shortn/ui";
import {
  ChartColumn,
  Copy,
  Lock,
  PanelRight,
  Pencil,
  Plus,
  QrCode,
  Search,
  Tag,
  Trash,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import type { PlanFeatures } from "@/lib/plan-features";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  createLinkAction,
  deleteLinksAction,
  listLinksAction,
  setLinkUtmAction,
  updateLinkAction,
  type LinkListItem,
} from "@/server/actions/links";
import { PageHeader } from "../shell/page-header";
import { canDeleteLink, canWrite, copyWhenReady, type Viewer } from "./access";
import { Composer, emptyComposerDraft, PinnedPasteField } from "./composer";
import { DeleteDialog } from "./delete-dialog";
import { networkFailure, useFormError, type FormError } from "./form-error";
import {
  createInput,
  emptyDraft,
  linkPatch,
  utmChanged,
  utmInput,
  utmView,
  type CreateInput,
  type LinkDraft,
  type UtmDraft,
} from "./link-draft";
import { LinkSheet, type SheetMode, type SheetTab } from "./link-sheet";

const urlLike =
  /^(https?:\/\/)?([\p{L}\p{N}-]+\.)+[\p{L}]{2,}(:\d+)?(\/\S*)?$/iu;
const searchDebounceMs = 250;
const deleteBatch = 500;
const goSequenceMs = 1200;

interface Filters {
  search: string;
  tags: string[];
}

const noFilters: Filters = { search: "", tags: [] };

const toRow = (link: LinkListItem): LinkRow => ({
  id: link.id,
  domain: link.domain,
  key: link.key,
  url: link.url,
  tags: link.tags.map((tag) => tag.name),
  clicks: link.clicks,
  trend: link.trend,
  createdAt: link.createdAt,
});

const listInput = (filters: Filters) => ({
  ...(filters.search ? { search: filters.search } : {}),
  ...(filters.tags.length ? { tags: filters.tags } : {}),
});

const mergeTags = (current: string[], added: string[]) => {
  const fresh = added.filter((tag) => !current.includes(tag));
  return fresh.length
    ? [...current, ...fresh].sort((a, b) => a.localeCompare(b))
    : current;
};

/** Keeps `?link=<id>` in the address bar so an open sheet can be shared or reloaded. */
function syncSheetUrl(linkId: string | null) {
  const url = new URL(window.location.href);
  if (linkId) url.searchParams.set("link", linkId);
  else url.searchParams.delete("link");
  url.searchParams.delete("tab");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export interface LinksDeskProps {
  workspace: string;
  /** Short link domain for new links, e.g. shortn.at. */
  domain: string;
  viewer: Viewer;
  features: PlanFeatures;
  pageSize: number;
  initialLinks: LinkListItem[];
  initialCursor: string | null;
  initialError: boolean;
  tags: string[];
  /** From `?link=<id>`: the sheet opens on this link. */
  initialLink: { link: LinkView; tab: SheetTab } | null;
}

export function LinksDesk({
  workspace,
  domain,
  viewer,
  features,
  pageSize,
  initialLinks,
  initialCursor,
  initialError,
  tags,
  initialLink,
}: LinksDeskProps) {
  const t = useTranslations("links");
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const desktop = useMediaQuery("(min-width: 1200px)");
  const toFormError = useFormError(features);
  const editable = canWrite(viewer);

  const [items, setItems] = useState(initialLinks);
  const [cursor, setCursor] = useState(initialCursor);
  const [status, setStatus] = useState<"ready" | "error">(
    initialError ? "error" : "ready",
  );
  const [loaded, setLoaded] = useState<Filters>(noFilters);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [allTags, setAllTags] = useState(tags);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState(emptyComposerDraft);
  const [creating, setCreating] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(initialLink !== null);
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(
    initialLink ? { kind: "link", ...initialLink } : null,
  );
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [fresh, setFresh] = useState<{ id: string; at: number } | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const debounceRef = useRef<number | undefined>(undefined);
  const latestFilters = useRef<Filters>(noFilters);
  const goPressedAt = useRef(0);

  const rows = useMemo(() => items.map(toRow), [items]);
  const byId = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const sheetLink = sheetMode?.kind === "link" ? sheetMode.link : null;
  const findLink = useCallback(
    (id: string): LinkView | undefined =>
      byId.get(id) ?? (sheetLink?.id === id ? sheetLink : undefined),
    [byId, sheetLink],
  );

  useEffect(() => () => window.clearTimeout(debounceRef.current), []);

  const runQuery = useCallback(
    (next: Filters) => {
      const request = ++requestRef.current;
      setSearching(true);
      setLoadingMore(false);
      setLoadMoreFailed(false);
      listLinksAction(workspace, { ...listInput(next), limit: pageSize }).then(
        (result) => {
          if (request !== requestRef.current) return;
          setSearching(false);
          if (!result.ok) {
            setStatus("error");
            return;
          }
          setItems(result.data.links);
          setCursor(result.data.nextCursor);
          setLoaded(next);
          setStatus("ready");
        },
        () => {
          if (request !== requestRef.current) return;
          setSearching(false);
          setStatus("error");
        },
      );
    },
    [workspace, pageSize],
  );

  const changeSearch = (value: string) => {
    setQuery(value);
    latestFilters.current = { ...latestFilters.current, search: value.trim() };
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(
      () => runQuery(latestFilters.current),
      searchDebounceMs,
    );
  };

  const changeTags = (next: string[]) => {
    setTagFilter(next);
    latestFilters.current = { ...latestFilters.current, tags: next };
    window.clearTimeout(debounceRef.current);
    runQuery(latestFilters.current);
  };

  const clearFilters = useCallback(() => {
    setQuery("");
    setTagFilter([]);
    latestFilters.current = noFilters;
    window.clearTimeout(debounceRef.current);
    runQuery(noFilters);
  }, [runQuery]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore || searching || loadMoreFailed) return;
    const request = requestRef.current;
    setLoadingMore(true);
    listLinksAction(workspace, {
      ...listInput(loaded),
      cursor,
      limit: pageSize,
    }).then(
      (result) => {
        if (request !== requestRef.current) return;
        setLoadingMore(false);
        if (!result.ok) {
          setLoadMoreFailed(true);
          return;
        }
        setItems((current) => {
          const seen = new Set(current.map((item) => item.id));
          return [
            ...current,
            ...result.data.links.filter((link) => !seen.has(link.id)),
          ];
        });
        setCursor(result.data.nextCursor);
      },
      () => {
        if (request !== requestRef.current) return;
        setLoadingMore(false);
        setLoadMoreFailed(true);
      },
    );
  }, [
    cursor,
    loadingMore,
    searching,
    loadMoreFailed,
    workspace,
    loaded,
    pageSize,
  ]);

  const openLink = useCallback(
    (id: string, tab: SheetTab) => {
      const link = findLink(id);
      if (!link) return;
      setSheetMode({ kind: "link", link, tab });
      setSheetOpen(true);
      syncSheetUrl(link.id);
    },
    [findLink],
  );

  const closeSheet = () => {
    setSheetOpen(false);
    syncSheetUrl(null);
  };

  const openComposer = useCallback(
    (url = "") => {
      if (!editable) return;
      setComposerOpen(true);
      setDraft((current) => (url ? { ...emptyComposerDraft, url } : current));
      setFocusToken((token) => token + 1);
    },
    [editable],
  );

  const focusSearch = useCallback(() => {
    setMobileSearchOpen(true);
    window.requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  }, []);

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
      // `G` then a key belongs to the shell's go-to navigation.
      const afterGo = Date.now() - goPressedAt.current < goSequenceMs;
      goPressedAt.current = key === "g" ? Date.now() : 0;
      if (afterGo) return;
      if (key === "c" && !event.shiftKey && editable) {
        event.preventDefault();
        openComposer();
      } else if (event.key === "/") {
        event.preventDefault();
        focusSearch();
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      if (
        !editable ||
        isTypingTarget(event.target) ||
        insideOverlay(event.target)
      )
        return;
      const text = event.clipboardData?.getData("text/plain").trim() ?? "";
      if (!urlLike.test(text)) return;
      event.preventDefault();
      openComposer(text);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("paste", onPaste);
    };
  }, [editable, openComposer, focusSearch]);

  const createLink = async (
    input: CreateInput,
    utm: UtmDraft[],
  ): Promise<
    { error: FormError } | { link: LinkListItem; utmError: FormError | null }
  > => {
    setCreating(true);
    const pending = createLinkAction(workspace, input);
    const copied = copyWhenReady(
      pending.then((result) =>
        result.ok
          ? shortUrl(result.data.domain, result.data.key)
          : Promise.reject(new Error(result.error)),
      ),
    );
    let result: Awaited<typeof pending>;
    try {
      result = await pending;
    } catch {
      setCreating(false);
      return { error: toFormError(networkFailure) };
    }
    setCreating(false);
    if (!result.ok)
      return { error: toFormError(result, { key: input.key ?? "" }) };

    let link = result.data;
    const label = `${link.domain}/${link.key}`;
    void copied.then((ok) =>
      announce(
        ok
          ? t("composer.created", { link: label })
          : t("composer.createdNotCopied", { link: label }),
      ),
    );
    let utmError: FormError | null = null;
    if (utm.length) {
      const saved = await setLinkUtmAction(
        workspace,
        link.id,
        utmInput(utm),
      ).catch(() => networkFailure);
      if (saved.ok) link = { ...link, utm: utmView(utm) };
      else utmError = toFormError(saved, { fallback: "utm" });
    }

    if (latestFilters.current.search || latestFilters.current.tags.length) {
      setQuery("");
      setTagFilter([]);
      latestFilters.current = noFilters;
      runQuery(noFilters);
    } else {
      const created = link;
      setItems((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
    }
    setAllTags((current) =>
      mergeTags(
        current,
        link.tags.map((tag) => tag.name),
      ),
    );
    setFresh({ id: link.id, at: Date.now() });
    router.refresh();
    return { link, utmError };
  };

  const submitComposer = () => {
    if (!draft.url.trim()) {
      setFocusToken((token) => token + 1);
      return;
    }
    const input = createInput(
      emptyDraft({
        url: draft.url,
        key: features.customKeys.allowed ? draft.key : "",
      }),
    );
    void createLink(input, []).then((outcome) => {
      if ("error" in outcome) {
        setDraft((current) => ({ ...current, error: outcome.error }));
        return;
      }
      setComposerOpen(false);
      setDraft(emptyComposerDraft);
    });
  };

  const createFromSheet = async (next: LinkDraft) => {
    const outcome = await createLink(
      createInput(next),
      features.campaigns.allowed ? next.utm : [],
    );
    if ("error" in outcome) return outcome.error;
    setComposerOpen(false);
    setDraft(emptyComposerDraft);
    if (outcome.utmError) {
      setSheetMode({
        kind: "link",
        link: outcome.link,
        tab: "edit",
        error: outcome.utmError,
      });
      syncSheetUrl(outcome.link.id);
    } else closeSheet();
    return null;
  };

  const applyUpdate = (link: LinkView) => {
    setItems((current) =>
      current.map((item) =>
        item.id === link.id ? { ...link, trend: item.trend } : item,
      ),
    );
    setAllTags((current) =>
      mergeTags(
        current,
        link.tags.map((tag) => tag.name),
      ),
    );
  };

  const saveLink = async (
    link: LinkView,
    next: LinkDraft,
  ): Promise<FormError | null> => {
    let updated = link;
    const patch = linkPatch(link, next);
    try {
      if (Object.keys(patch).length > 0) {
        const result = await updateLinkAction(workspace, link.id, patch);
        if (!result.ok) return toFormError(result, { key: patch.key ?? "" });
        updated = result.data;
      }
      if (features.campaigns.allowed && utmChanged(link, next)) {
        const result = await setLinkUtmAction(
          workspace,
          link.id,
          utmInput(next.utm),
        );
        if (!result.ok) {
          applyUpdate(updated);
          const saved = updated;
          setSheetMode((mode) =>
            mode?.kind === "link" ? { ...mode, link: saved } : mode,
          );
          return toFormError(result, { fallback: "utm" });
        }
        updated = { ...updated, utm: utmView(next.utm) };
      }
    } catch {
      return toFormError(networkFailure);
    }
    applyUpdate(updated);
    setSheetMode({ kind: "link", link: updated, tab: "overview" });
    return null;
  };

  const deleteTargets = (deleteIds ?? []).flatMap((id) => {
    const link = findLink(id);
    return link ? [link] : [];
  });
  const deletable = deleteTargets.filter((link) => canDeleteLink(viewer, link));

  const confirmDelete = async (): Promise<string | null> => {
    const ids = deletable.map((link) => link.id);
    const deleted = new Set<string>();
    let failure: FormError | null = null;
    try {
      for (let start = 0; start < ids.length; start += deleteBatch) {
        const result = await deleteLinksAction(
          workspace,
          ids.slice(start, start + deleteBatch),
        );
        if (!result.ok) {
          failure = toFormError(result);
          break;
        }
        for (const id of result.data.deleted) deleted.add(id);
      }
    } catch {
      failure = toFormError(networkFailure);
    }
    if (deleted.size) {
      setItems((current) => current.filter((item) => !deleted.has(item.id)));
      if (sheetLink && deleted.has(sheetLink.id)) closeSheet();
      router.refresh();
    }
    if (failure)
      return failure.kind === "message" ? failure.message : t("errors.generic");
    setDeleteIds(null);
    announce(t("delete.done", { count: deleted.size }));
    return null;
  };

  const copyRow = (row: LinkRow) => {
    void copyText(shortUrl(row.domain, row.key)).then((ok) =>
      announce(
        ok
          ? t("composer.copied", { link: `${row.domain}/${row.key}` })
          : t("errors.copyFailed"),
      ),
    );
  };

  const filtering = query.trim() !== "" || tagFilter.length > 0;
  const count = `${formatNumber(items.length, intlLocale)}${cursor ? "+" : ""}`;
  const viewerProps = editable ? {} : { disabledReason: t("viewerReason") };
  const tagField: FilterField[] = [
    {
      id: "tag",
      label: t("tag"),
      icon: <Tag aria-hidden />,
      options: mergeTags(allTags, tagFilter).map((tag) => ({
        value: tag,
        label: tag,
      })),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        count={status === "ready" ? count : undefined}
        className="flex-wrap gap-y-2 py-2.5"
      >
        <Input
          ref={searchRef}
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          maxLength={200}
          onChange={(event) => changeSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              changeSearch("");
            } else if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          leading={<Search aria-hidden />}
          trailing={
            query ? (
              <button
                type="button"
                aria-label={t("clearSearch")}
                onClick={() => changeSearch("")}
                className="-mr-1 grid size-5 cursor-pointer place-items-center rounded-chip hover:text-fg"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            ) : (
              <KeyboardHint keys="/" className="max-md:hidden" />
            )
          }
          frameClassName={cn(
            "w-60 max-md:order-last max-md:w-full",
            !mobileSearchOpen && !query && "max-md:hidden",
          )}
        />
        {allTags.length > 0 || tagFilter.length > 0 ? (
          <FilterBar
            fields={tagField}
            value={tagFilter.length ? { tag: tagFilter } : {}}
            onValueChange={(next) => changeTags(next.tag ?? [])}
            pickerPlaceholder={t("filterBy")}
            className="max-md:hidden"
          />
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          {editable ? null : (
            <span className="inline-flex items-center gap-1.5 text-small whitespace-nowrap text-fg-muted">
              <Lock aria-hidden className="size-3.5" />
              {t("viewOnly")}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-md"
            aria-label={t("search")}
            aria-expanded={mobileSearchOpen}
            onClick={() =>
              mobileSearchOpen ? setMobileSearchOpen(false) : focusSearch()
            }
            className="md:hidden"
          >
            <Search aria-hidden />
          </Button>
          <Button
            variant="primary"
            shortcut="c"
            onClick={() => openComposer()}
            className="max-sm:hidden"
            {...viewerProps}
          >
            <Plus aria-hidden />
            {t("create")}
          </Button>
          <Button
            variant="primary"
            size="icon-md"
            aria-label={t("create")}
            onClick={() => openComposer()}
            className="sm:hidden"
            {...viewerProps}
          >
            <Plus aria-hidden />
          </Button>
        </div>
      </PageHeader>

      {composerOpen && editable ? (
        <Composer
          draft={draft}
          onChange={setDraft}
          onSubmit={submitComposer}
          onClose={() => {
            setComposerOpen(false);
            setDraft(emptyComposerDraft);
          }}
          onMoreOptions={() => {
            setSheetMode({
              kind: "create",
              draft: emptyDraft({
                url: draft.url.trim(),
                key: features.customKeys.allowed ? draft.key : "",
              }),
            });
            setSheetOpen(true);
          }}
          focusToken={focusToken}
          domain={domain}
          keyGate={
            features.customKeys.allowed ? null : features.customKeys.plan
          }
          pending={creating}
        />
      ) : editable && status === "ready" ? (
        <PinnedPasteField onActivate={() => openComposer()} />
      ) : null}

      <LinksTable
        label={t("title")}
        links={rows}
        status={status}
        compactColumns={!desktop}
        fresh={fresh}
        onOpen={(row, intent) => openLink(row.id, intent)}
        onEndReached={loadMore}
        loadingMore={loadingMore}
        className={cn(
          "transition-opacity duration-(--motion-fast)",
          searching && "opacity-60",
        )}
        bulkActionsLabel={t("bulk.label")}
        renderBulkActions={(selected) => (
          <>
            <Button
              variant="ghost"
              size="sm"
              tooltip={t("bulk.copy")}
              onClick={() => {
                void copyText(
                  selected
                    .map((row) => shortUrl(row.domain, row.key))
                    .join("\n"),
                ).then((ok) =>
                  announce(
                    ok
                      ? t("bulk.copied", { count: selected.length })
                      : t("errors.copyFailed"),
                  ),
                );
              }}
            >
              <Copy aria-hidden />
              <span className="max-xl:sr-only">{t("bulk.copy")}</span>
            </Button>
            <Button
              variant="dangerGhost"
              size="sm"
              onClick={() => setDeleteIds(selected.map((row) => row.id))}
              {...(editable ? { tooltip: t("bulk.delete") } : viewerProps)}
            >
              <Trash aria-hidden />
              <span className="max-xl:sr-only">{t("bulk.delete")}</span>
            </Button>
          </>
        )}
        renderRowActions={(row) => {
          const link = byId.get(row.id);
          return (
            <>
              <DropdownMenuItem
                icon={<PanelRight aria-hidden />}
                shortcut="enter"
                onSelect={() => openLink(row.id, "overview")}
              >
                {t("rowActions.open")}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<Pencil aria-hidden />}
                shortcut="e"
                onSelect={() => openLink(row.id, "edit")}
              >
                {t("rowActions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<Copy aria-hidden />}
                shortcut={["mod", "c"]}
                onSelect={() => copyRow(row)}
              >
                {t("rowActions.copy")}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<ChartColumn aria-hidden />}
                onSelect={() =>
                  router.push(`/${workspace}/links/${row.id}` as const)
                }
              >
                {t("rowActions.analytics")}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<QrCode aria-hidden />}
                onSelect={() => openLink(row.id, "qr")}
              >
                {t("rowActions.qr")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<Trash aria-hidden />}
                tone="danger"
                disabled={!link || !canDeleteLink(viewer, link)}
                onSelect={() => setDeleteIds([row.id])}
              >
                {t("rowActions.delete")}
              </DropdownMenuItem>
            </>
          );
        }}
        errorState={
          <EmptyState
            tone="danger"
            title={t("error.title")}
            description={t("error.body")}
            action={
              <Button onClick={() => runQuery(latestFilters.current)}>
                {t("retry")}
              </Button>
            }
          />
        }
        emptyState={
          filtering ? (
            <EmptyState
              title={
                query.trim()
                  ? t("empty.noMatch", { query: query.trim() })
                  : t("empty.noMatchFilters")
              }
              description={t("empty.noMatchBody")}
              action={
                <Button onClick={clearFilters}>{t("empty.clear")}</Button>
              }
            />
          ) : (
            <EmptyState
              title={t("empty.firstTitle")}
              description={
                editable ? t("empty.firstBody") : t("empty.firstBodyViewer")
              }
              action={
                <Button
                  variant="primary"
                  shortcut="c"
                  onClick={() => openComposer()}
                  {...viewerProps}
                >
                  {t("create")}
                </Button>
              }
            />
          )
        }
      />
      {loadMoreFailed ? (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-center gap-2 border-t border-line px-gutter py-2 text-small text-fg-muted"
        >
          {t("loadMoreFailed")}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLoadMoreFailed(false)}
          >
            {t("retry")}
          </Button>
        </div>
      ) : null}

      <LinkSheet
        open={sheetOpen}
        onOpenChange={(open) => (open ? setSheetOpen(true) : closeSheet())}
        mode={sheetMode}
        onTabChange={(tab) =>
          setSheetMode((mode) =>
            mode?.kind === "link" ? { ...mode, tab, error: null } : mode,
          )
        }
        workspace={workspace}
        domain={domain}
        viewer={viewer}
        features={features}
        allTags={allTags}
        onCreate={createFromSheet}
        onSave={saveLink}
        onDelete={(link) => setDeleteIds([link.id])}
      />

      <DeleteDialog
        target={
          deleteIds
            ? { count: deleteTargets.length, deletable: deletable.length }
            : null
        }
        onOpenChange={(open) => {
          if (!open) setDeleteIds(null);
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}
