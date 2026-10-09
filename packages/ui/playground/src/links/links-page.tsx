import {
  announce,
  Button,
  cn,
  Combobox,
  copyText,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
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
  toast,
  useUILocale,
  type FilterField,
  type FilterValue,
  type LinkRow,
} from "@shortn/ui";
import {
  Archive,
  CalendarClock,
  Copy,
  Download,
  Lock,
  Menu,
  PanelRight,
  Pencil,
  Plus,
  QrCode,
  Search,
  Tag,
  Trash,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayground } from "../app-context";
import {
  DEMO_DOMAIN,
  generateLinks,
  isLongContent,
  suggestKey,
  TEAM,
} from "../data/links";
import { linksApiRegistry } from "../lib/links-api";
import { useMediaQuery } from "../lib/use-media-query";
import {
  Composer,
  EMPTY_DRAFT,
  PinnedPasteField,
  type ComposerDraft,
} from "./composer";
import { LinkSheet, type LinkDraft, type SheetTab } from "./link-sheet";

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const URL_LIKE =
  /^(https?:\/\/)?([\p{L}\p{N}-]+\.)+[\p{L}]{2,}(:\d+)?(\/\S*)?$/iu;
const DAY = 86_400_000;

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

const fold = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface SheetState {
  open: boolean;
  linkId: string | null;
  tab: SheetTab;
  createDraft: LinkDraft | null;
}

export function LinksPage({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { copy, route, setDemoState } = usePlayground();
  const { intlLocale } = useUILocale();
  const demo = route.state;
  const canEdit = demo !== "readonly";
  const desktop = useMediaQuery("(min-width: 1200px)");

  const [allLinks, setAllLinks] = useState<LinkRow[]>(() => generateLinks());
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterValue>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft>(EMPTY_DRAFT);
  const [focusToken, setFocusToken] = useState(0);
  const [sheet, setSheet] = useState<SheetState>({
    open: false,
    linkId: null,
    tab: "overview",
    createDraft: null,
  });
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [fresh, setFresh] = useState<{ id: string; at: number } | null>(null);
  const [activeLink, setActiveLink] = useState<LinkRow | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const clearSelectionRef = useRef<() => void>(() => {});
  const [now] = useState(() => Date.now());

  const workspaceLinks = useMemo(() => {
    if (demo === "empty")
      return allLinks.filter((link) => link.id.startsWith("lnk_new"));
    if (demo === "long") {
      return allLinks.map((link, index) =>
        isLongContent(link)
          ? {
              ...link,
              createdAt: new Date(now - (index + 1) * 60_000).toISOString(),
            }
          : link,
      );
    }
    return allLinks;
  }, [allLinks, demo, now]);

  const allTags = useMemo(
    () =>
      [...new Set(workspaceLinks.flatMap((link) => link.tags))]
        .sort()
        .slice(0, 40),
    [workspaceLinks],
  );

  const filterFields = useMemo<FilterField[]>(
    () => [
      {
        id: "tag",
        label: copy.links.tag,
        icon: <Tag aria-hidden />,
        options: allTags
          .filter((tag) => !tag.startsWith("edicao-"))
          .map((tag) => ({ value: tag, label: tag })),
      },
      {
        id: "createdBy",
        label: copy.links.createdBy,
        icon: <UserRound aria-hidden />,
        options: TEAM.map((name) => ({ value: name, label: name })),
      },
      {
        id: "created",
        label: copy.links.created,
        icon: <CalendarClock aria-hidden />,
        options: [
          { value: "7", label: copy.links.within7 },
          { value: "30", label: copy.links.within30 },
          { value: "90", label: copy.links.within90 },
        ],
      },
    ],
    [allTags, copy],
  );

  const visibleLinks = useMemo(() => {
    const needle = fold(query.trim());
    const tagFilter = filters.tag ?? [];
    const peopleFilter = filters.createdBy ?? [];
    const windowDays = Math.max(0, ...(filters.created ?? []).map(Number));
    const cutoff = windowDays > 0 ? now - windowDays * DAY : 0;
    return workspaceLinks.filter((link) => {
      if (
        tagFilter.length > 0 &&
        !link.tags.some((tag) => tagFilter.includes(tag))
      )
        return false;
      if (
        peopleFilter.length > 0 &&
        !peopleFilter.includes(link.createdBy ?? "")
      )
        return false;
      if (cutoff > 0 && Date.parse(link.createdAt) < cutoff) return false;
      if (!needle) return true;
      return fold(`${link.key} ${link.url} ${link.tags.join(" ")}`).includes(
        needle,
      );
    });
  }, [workspaceLinks, query, filters, now]);

  const openComposer = useCallback(
    (url = "") => {
      if (!canEdit) return;
      setComposerOpen(true);
      setDraft(
        url
          ? {
              url,
              key: suggestKey(normalizeUrl(url) ?? url),
              keyEdited: false,
              error: null,
            }
          : EMPTY_DRAFT,
      );
      setFocusToken((token) => token + 1);
    },
    [canEdit],
  );

  const createLink = useCallback(
    (input: {
      url: string;
      key: string;
      tags: string[];
    }): { field: "url" | "key"; message: string } | null => {
      const url = normalizeUrl(input.url);
      if (!url) return { field: "url", message: copy.composer.invalidUrl };
      const key = (input.key.trim() || suggestKey(url)).slice(0, 64);
      if (!KEY_PATTERN.test(key))
        return { field: "key", message: copy.composer.keyInvalid };
      const taken = new Set(allLinks.map((link) => link.key.toLowerCase()));
      if (taken.has(key.toLowerCase())) {
        let suffix = 2;
        while (taken.has(`${key}-${suffix}`.toLowerCase())) suffix++;
        return {
          field: "key",
          message: copy.composer.keyTaken(key, `${key}-${suffix}`),
        };
      }
      const link: LinkRow = {
        id: `lnk_new_${Date.now().toString(36)}`,
        domain: DEMO_DOMAIN,
        key,
        url,
        tags: input.tags,
        clicks: 0,
        trend: Array.from({ length: 30 }, () => 0),
        createdAt: new Date().toISOString(),
        createdBy: copy.account.name,
        ...(new URL(url).hostname.endsWith("gazetaexemplo.pt")
          ? { faviconSrc: "/demo/gazeta-exemplo.svg" }
          : {}),
      };
      setAllLinks((current) => [link, ...current]);
      setQuery("");
      setFilters({});
      setFresh({ id: link.id, at: Date.now() });
      void copyText(shortUrl(link.domain, link.key));
      announce(copy.composer.created(`${link.domain}/${link.key}`));
      return null;
    },
    [allLinks, copy],
  );

  const submitComposer = () => {
    const error = createLink({ url: draft.url, key: draft.key, tags: [] });
    if (error) {
      setDraft({ ...draft, error });
      return;
    }
    setComposerOpen(false);
    setDraft(EMPTY_DRAFT);
  };

  const openLink = useCallback((link: LinkRow, tab: SheetTab) => {
    setSheet({ open: true, linkId: link.id, tab, createDraft: null });
  }, []);

  const copyLink = useCallback(
    (link: LinkRow) => {
      void copyText(shortUrl(link.domain, link.key)).then((ok) => {
        if (ok)
          toast(copy.toasts.copied(1), {
            description: `${link.domain}/${link.key}`,
          });
      });
    },
    [copy],
  );

  const createFromClipboard = useCallback(() => {
    navigator.clipboard
      .readText()
      .then((text) =>
        openComposer(URL_LIKE.test(text.trim()) ? text.trim() : ""),
      )
      .catch(() => openComposer());
  }, [openComposer]);

  const focusSearch = useCallback(() => {
    setMobileSearchOpen(true);
    window.requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  }, []);

  useEffect(() => {
    linksApiRegistry.set({
      links: workspaceLinks,
      activeLink,
      canEdit,
      openComposer,
      createFromClipboard,
      focusSearch,
      openLink,
      copyLink,
    });
    return () => linksApiRegistry.set(null);
  }, [
    workspaceLinks,
    activeLink,
    canEdit,
    openComposer,
    createFromClipboard,
    focusSearch,
    openLink,
    copyLink,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"], [role="menu"]')
      )
        return;
      if (event.key === "c" && canEdit) {
        event.preventDefault();
        openComposer();
      } else if (event.key === "/") {
        event.preventDefault();
        focusSearch();
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      if (!canEdit || isTypingTarget(event.target)) return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"]')
      )
        return;
      const text = event.clipboardData?.getData("text/plain").trim() ?? "";
      if (!URL_LIKE.test(text)) return;
      event.preventDefault();
      openComposer(text);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("paste", onPaste);
    };
  }, [canEdit, openComposer, focusSearch]);

  const archive = (ids: string[]) => {
    const removed = allLinks.filter((link) => ids.includes(link.id));
    setAllLinks((current) => current.filter((link) => !ids.includes(link.id)));
    clearSelectionRef.current();
    toast(copy.toasts.archived(removed.length), {
      action: {
        label: copy.toasts.undo,
        onClick: () => setAllLinks((current) => [...removed, ...current]),
      },
    });
  };

  const exportCsv = (rows: LinkRow[]) => {
    window.setTimeout(() => {
      toast(copy.toasts.exportReady, {
        description: copy.toasts.exportDetail(rows.length),
        action: {
          label: copy.toasts.download,
          onClick: () => {
            const header = "short_link,destination,tags,clicks,created_at";
            const body = rows.map((link) =>
              [
                `${link.domain}/${link.key}`,
                link.url,
                link.tags.join(" "),
                link.clicks,
                link.createdAt,
              ]
                .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
                .join(","),
            );
            const href = URL.createObjectURL(
              new Blob([[header, ...body].join("\n")], { type: "text/csv" }),
            );
            const anchor = document.createElement("a");
            anchor.href = href;
            anchor.download = "links-export.csv";
            anchor.click();
            URL.revokeObjectURL(href);
          },
        },
      });
    }, 900);
  };

  const status =
    demo === "loading" ? "loading" : demo === "error" ? "error" : "ready";
  const filtering = query.trim() !== "" || Object.keys(filters).length > 0;
  const total = workspaceLinks.length;
  const count = filtering
    ? copy.links.countOf(
        formatNumber(visibleLinks.length, intlLocale),
        formatNumber(total, intlLocale),
      )
    : formatNumber(total, intlLocale);
  const sheetLink = sheet.linkId
    ? (allLinks.find((link) => link.id === sheet.linkId) ?? null)
    : null;
  const readOnlyReason = copy.links.viewerReason;
  const disabledProps = canEdit ? {} : { disabledReason: readOnlyReason };

  return (
    <>
      <header className="flex min-h-page-header shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-gutter py-2.5">
        <Button
          variant="ghost"
          size="icon-md"
          className="-ml-2 md:hidden"
          aria-label={copy.nav.openMenu}
          onClick={onOpenDrawer}
        >
          <Menu aria-hidden />
        </Button>
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-title font-semibold tracking-[-0.015em]">
            {copy.links.title}
          </h1>
          <span
            className="font-mono text-small whitespace-nowrap text-fg-muted tabular-nums"
            aria-live="polite"
          >
            {status === "ready" ? count : null}
          </span>
        </div>
        <Input
          ref={searchRef}
          type="search"
          aria-label={copy.links.search}
          placeholder={copy.links.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              setQuery("");
            } else if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
          leading={<Search aria-hidden />}
          trailing={
            query ? (
              <button
                type="button"
                aria-label={copy.empty.clear}
                onClick={() => setQuery("")}
                className="-mr-1 grid size-5 place-items-center rounded-chip hover:text-fg"
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
        <FilterBar
          fields={filterFields}
          value={filters}
          onValueChange={setFilters}
          pickerPlaceholder={copy.links.filterBy}
          className="max-md:hidden"
        />
        <div className="ml-auto flex items-center gap-3">
          {canEdit ? null : (
            <span className="inline-flex items-center gap-1.5 text-small whitespace-nowrap text-fg-muted">
              <Lock aria-hidden className="size-3.5" />
              {copy.links.viewOnly}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-md"
            aria-label={copy.links.search}
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
            {...disabledProps}
          >
            <Plus aria-hidden />
            {copy.links.create}
          </Button>
          <Button
            variant="primary"
            size="icon-md"
            aria-label={copy.links.create}
            onClick={() => openComposer()}
            className="sm:hidden"
            {...disabledProps}
          >
            <Plus aria-hidden />
          </Button>
        </div>
      </header>

      {composerOpen && canEdit ? (
        <Composer
          draft={draft}
          onChange={setDraft}
          onSubmit={submitComposer}
          onClose={() => {
            setComposerOpen(false);
            setDraft(EMPTY_DRAFT);
          }}
          onMoreOptions={() => {
            setSheet({
              open: true,
              linkId: null,
              tab: "edit",
              createDraft: {
                url: draft.url,
                key: draft.key,
                tags: [],
                campaign: "",
                interstitial: false,
              },
            });
          }}
          suggestKey={suggestKey}
          focusToken={focusToken}
        />
      ) : canEdit && status === "ready" ? (
        <PinnedPasteField onActivate={() => openComposer()} />
      ) : null}

      <LinksTable
        label={copy.links.title}
        links={visibleLinks}
        status={status}
        compactColumns={!desktop}
        fresh={fresh}
        onActiveChange={setActiveLink}
        onOpen={(link, intent) => openLink(link, intent)}
        bulkActionsLabel={copy.bulk.label}
        renderBulkActions={(selected, clear) => {
          clearSelectionRef.current = clear;
          return (
            <BulkActions
              selected={selected}
              canEdit={canEdit}
              allTags={allTags}
              onCopy={() => {
                void copyText(
                  selected
                    .map((link) => shortUrl(link.domain, link.key))
                    .join("\n"),
                ).then(() =>
                  toast(copy.toasts.copied(selected.length), {
                    description: copy.toasts.copiedDetail,
                  }),
                );
              }}
              onTag={(tag) => {
                const ids = new Set(selected.map((link) => link.id));
                setAllLinks((current) =>
                  current.map((link) =>
                    ids.has(link.id) && !link.tags.includes(tag)
                      ? { ...link, tags: [...link.tags, tag] }
                      : link,
                  ),
                );
              }}
              onExport={() => exportCsv(selected)}
              onArchive={() => archive(selected.map((link) => link.id))}
              onDelete={() => setDeleteIds(selected.map((link) => link.id))}
            />
          );
        }}
        renderRowActions={(link) => (
          <>
            <DropdownMenuItem
              icon={<PanelRight aria-hidden />}
              shortcut="enter"
              onSelect={() => openLink(link, "overview")}
            >
              {copy.rowActions.open}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Pencil aria-hidden />}
              shortcut="e"
              onSelect={() => openLink(link, "edit")}
            >
              {copy.rowActions.edit}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Copy aria-hidden />}
              shortcut={["mod", "c"]}
              onSelect={() => copyLink(link)}
            >
              {copy.rowActions.copy}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<QrCode aria-hidden />}
              onSelect={() => openLink(link, "qr")}
            >
              {copy.rowActions.qr}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<Archive aria-hidden />}
              disabled={!canEdit}
              onSelect={() => archive([link.id])}
            >
              {copy.rowActions.archive}
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Trash aria-hidden />}
              tone="danger"
              disabled={!canEdit}
              onSelect={() => setDeleteIds([link.id])}
            >
              {copy.rowActions.delete}
            </DropdownMenuItem>
          </>
        )}
        errorState={
          <EmptyState
            tone="danger"
            title={copy.error.title}
            description={copy.error.body}
            action={
              <Button
                onClick={() => {
                  setDemoState("loading");
                  window.setTimeout(() => setDemoState("ready"), 900);
                }}
              >
                {copy.error.retry}
              </Button>
            }
          />
        }
        emptyState={
          filtering ? (
            <EmptyState
              title={copy.empty.noMatch(query.trim())}
              description={copy.empty.noMatchBody}
              action={
                <Button
                  onClick={() => {
                    setQuery("");
                    setFilters({});
                  }}
                >
                  {copy.empty.clear}
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={copy.empty.firstTitle}
              description={copy.empty.firstBody}
              action={
                <Button
                  variant="primary"
                  shortcut="c"
                  onClick={() => openComposer()}
                  {...disabledProps}
                >
                  {copy.links.create}
                </Button>
              }
            />
          )
        }
      />

      <LinkSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        link={sheetLink}
        createDraft={sheet.createDraft}
        tab={sheet.tab}
        onTabChange={(tab) => setSheet((current) => ({ ...current, tab }))}
        canEdit={canEdit}
        allTags={allTags}
        onSave={(next) => {
          if (sheet.createDraft) {
            const error = createLink({
              url: next.url,
              key: next.key,
              tags: next.tags,
            });
            if (error) return error.message;
            setComposerOpen(false);
            setDraft(EMPTY_DRAFT);
            setSheet((current) => ({ ...current, open: false }));
            return null;
          }
          const url = normalizeUrl(next.url);
          if (!url) return copy.composer.invalidUrl;
          if (!KEY_PATTERN.test(next.key)) return copy.composer.keyInvalid;
          if (
            allLinks.some(
              (link) =>
                link.id !== sheet.linkId &&
                link.key.toLowerCase() === next.key.toLowerCase(),
            )
          ) {
            return copy.composer.keyTaken(next.key, `${next.key}-2`);
          }
          setAllLinks((current) =>
            current.map((link) =>
              link.id === sheet.linkId
                ? { ...link, url, key: next.key, tags: next.tags }
                : link,
            ),
          );
          setSheet((current) => ({ ...current, tab: "overview" }));
          return null;
        }}
      />

      <Dialog
        open={deleteIds !== null}
        onOpenChange={(open) => (open ? null : setDeleteIds(null))}
      >
        <DialogContent>
          <DialogHeader
            title={copy.dialog.deleteTitle(deleteIds?.length ?? 0)}
            description={copy.dialog.deleteBody}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteIds(null)}>
              {copy.dialog.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const ids = new Set(deleteIds ?? []);
                setAllLinks((current) =>
                  current.filter((link) => !ids.has(link.id)),
                );
                clearSelectionRef.current();
                setDeleteIds(null);
              }}
            >
              {copy.dialog.confirm(deleteIds?.length ?? 0)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BulkActions({
  selected,
  canEdit,
  allTags,
  onCopy,
  onTag,
  onExport,
  onArchive,
  onDelete,
}: {
  selected: LinkRow[];
  canEdit: boolean;
  allTags: string[];
  onCopy: () => void;
  onTag: (tag: string) => void;
  onExport: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { copy } = usePlayground();
  const reason = canEdit ? {} : { disabledReason: copy.links.viewerReason };
  const label = "max-xl:sr-only";
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopy}
        tooltip={copy.bulk.copy}
      >
        <Copy aria-hidden />
        <span className={label}>{copy.bulk.copy}</span>
      </Button>
      {canEdit ? (
        <Combobox
          options={allTags.map((tag) => ({ value: tag, label: tag }))}
          value={[]}
          onValueChange={(next) => {
            const tag = next[0];
            if (tag) {
              onTag(tag);
              toast(copy.toasts.tagged(selected.length, tag));
            }
          }}
          placeholder={copy.bulk.tag}
          searchPlaceholder={copy.bulk.tagSearch}
          emptyText={copy.bulk.noTags}
          createLabel={copy.bulk.createTag}
          onCreate={(tag) => {
            onTag(tag);
            toast(copy.toasts.tagged(selected.length, tag));
          }}
          trigger={
            <Button variant="ghost" size="sm" tooltip={copy.bulk.tag}>
              <Tag aria-hidden />
              <span className={label}>{copy.bulk.tag}</span>
            </Button>
          }
        />
      ) : (
        <Button variant="ghost" size="sm" {...reason}>
          <Tag aria-hidden />
          <span className={label}>{copy.bulk.tag}</span>
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onExport}
        tooltip={copy.bulk.export}
      >
        <Download aria-hidden />
        <span className={label}>{copy.bulk.export}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onArchive}
        {...(canEdit ? { tooltip: copy.bulk.archive } : reason)}
      >
        <Archive aria-hidden />
        <span className={label}>{copy.bulk.archive}</span>
      </Button>
      <Button
        variant="dangerGhost"
        size="sm"
        onClick={onDelete}
        {...(canEdit ? { tooltip: copy.bulk.delete } : reason)}
      >
        <Trash aria-hidden />
        <span className={label}>{copy.bulk.delete}</span>
      </Button>
    </>
  );
}
