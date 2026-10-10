import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Columns3, Ellipsis } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useUILocale } from "../i18n/provider";
import { announce, copyText, shortUrl } from "../lib/clipboard";
import { cn } from "../lib/cn";
import { formatAge, formatDate, formatNumber } from "../lib/format";
import { isTypingTarget } from "../lib/platform";
import { useElementWidth } from "../lib/use-element-width";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Destination, Favicon, parseDestination } from "./destination";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { ShortLink } from "./short-link";
import { Skeleton } from "./skeleton";
import { Sparkline } from "./sparkline";
import { TagChips } from "./tag-chips";
import { Tooltip } from "./tooltip";

export interface LinkRow {
  id: string;
  domain: string;
  key: string;
  url: string;
  tags: string[];
  clicks: number;
  /** Daily clicks for the last 30 days, oldest first. */
  trend: number[];
  createdAt: string;
  createdBy?: string;
  faviconSrc?: string;
}

export type LinkColumnId =
  | "select"
  | "link"
  | "destination"
  | "tags"
  | "trend"
  | "clicks"
  | "created"
  | "actions";
export type LinkOpenIntent = "overview" | "edit";
export type LinksTableStatus = "ready" | "loading" | "error";

const HIDEABLE_COLUMNS = [
  "destination",
  "tags",
  "trend",
  "clicks",
  "created",
] as const;
const COMPACT_HIDDEN: VisibilityState = { tags: false, trend: false };

const COLUMN_TRACK: Record<LinkColumnId, string> = {
  select: "calc(var(--space-gutter) + 28px)",
  link: "minmax(180px, 1.1fr)",
  destination: "minmax(160px, 1.45fr)",
  tags: "minmax(120px, 0.7fr)",
  trend: "100px",
  clicks: "84px",
  created: "88px",
  actions: "calc(var(--space-gutter) + 32px)",
};

const ROW_HEIGHT = 44;
const LIST_ROW_HEIGHT = 60;
const HEADER_HEIGHT = 36;
const LIST_BREAKPOINT = 640;
const COMPACT_BREAKPOINT = 900;

const columns: ColumnDef<LinkRow>[] = [
  { id: "select", enableSorting: false, enableHiding: false },
  {
    id: "link",
    accessorFn: (row) => row.key,
    enableSorting: false,
    enableHiding: false,
  },
  { id: "destination", accessorFn: (row) => row.url, enableSorting: false },
  { id: "tags", accessorFn: (row) => row.tags.join(","), enableSorting: false },
  {
    id: "trend",
    accessorFn: (row) => row.trend.reduce((sum, value) => sum + value, 0),
    enableSorting: false,
  },
  { id: "clicks", accessorFn: (row) => row.clicks, sortDescFirst: true },
  {
    id: "created",
    accessorFn: (row) => Date.parse(row.createdAt),
    sortDescFirst: true,
  },
  { id: "actions", enableSorting: false, enableHiding: false },
];

export interface LinksTableProps {
  links: LinkRow[];
  /** Accessible name of the grid, e.g. "Links". */
  label: string;
  status?: LinksTableStatus;
  /** Rendered in place of rows when `status` is "error". */
  errorState?: ReactNode;
  /** Rendered in place of rows when ready with no links. */
  emptyState?: ReactNode;
  /** Hides the tags and 30-day columns by default (they stay available in the column menu). */
  compactColumns?: boolean;
  now?: Date;
  onOpen: (link: LinkRow, intent: LinkOpenIntent) => void;
  onCopy?: (link: LinkRow) => void;
  /** Content of the per-row "more" menu. */
  renderRowActions?: (link: LinkRow) => ReactNode;
  /** Buttons for the bulk action bar that replaces the header while rows are selected. */
  renderBulkActions?: (
    selected: LinkRow[],
    clearSelection: () => void,
  ) => ReactNode;
  bulkActionsLabel?: string;
  /** Row to highlight and show as copied, e.g. right after create-and-copy. */
  fresh?: { id: string; at: number } | null;
  onActiveChange?: (link: LinkRow | null) => void;
  className?: string;
}

export function LinksTable({
  links,
  label,
  status = "ready",
  errorState,
  emptyState,
  compactColumns,
  now = new Date(),
  onOpen,
  onCopy,
  renderRowActions,
  renderBulkActions,
  bulkActionsLabel,
  fresh,
  onActiveChange,
  className,
}: LinksTableProps) {
  const { t, intlLocale } = useUILocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(scrollRef);
  const listLayout = width < LIST_BREAKPOINT;
  const compact = compactColumns ?? width < COMPACT_BREAKPOINT;

  const [sorting, setSorting] = useState<SortingState>([
    { id: "created", desc: true },
  ]);
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copiedSignal, setCopiedSignal] = useState<{
    id: string;
    at: number;
  } | null>(null);
  const anchorIndex = useRef<number | null>(null);
  const pendingFocus = useRef(false);

  const columnVisibility = useMemo(
    () => ({ ...(compact ? COMPACT_HIDDEN : {}), ...userVisibility }),
    [compact, userVisibility],
  );

  const table = useReactTable({
    data: links,
    columns,
    state: { sorting, columnVisibility, rowSelection },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  const rows = table.getRowModel().rows;
  const ordered = useMemo(() => rows.map((row) => row.original), [rows]);
  const visibleColumns = table
    .getVisibleLeafColumns()
    .map((column) => column.id as LinkColumnId);
  const template = visibleColumns.map((id) => COLUMN_TRACK[id]).join(" ");
  const selectedLinks = useMemo(
    () => ordered.filter((link) => rowSelection[link.id]),
    [ordered, rowSelection],
  );
  const selectedCount = selectedLinks.length;
  const activeIndex =
    activeId === null ? -1 : ordered.findIndex((link) => link.id === activeId);
  const rowHeight = listLayout ? LIST_ROW_HEIGHT : ROW_HEIGHT;
  const showRows = status === "ready" && ordered.length > 0;

  useEffect(() => {
    const valid = new Set(links.map((link) => link.id));
    setRowSelection((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([id]) => valid.has(id)),
      );
      return Object.keys(next).length === Object.keys(current).length
        ? current
        : next;
    });
  }, [links]);

  useEffect(() => {
    onActiveChange?.(activeIndex >= 0 ? (ordered[activeIndex] ?? null) : null);
  }, [activeIndex, ordered, onActiveChange]);

  const virtualizer = useVirtualizer({
    count: showRows ? ordered.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    scrollMargin: listLayout ? 0 : HEADER_HEIGHT,
    scrollPaddingStart: listLayout ? 0 : HEADER_HEIGHT,
    getItemKey: (index) => ordered[index]?.id ?? index,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  const freshId = fresh?.id;
  useEffect(() => {
    if (!freshId) return;
    setActiveId(freshId);
    const index = ordered.findIndex((link) => link.id === freshId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to a new fresh link
  }, [freshId]);

  useEffect(() => {
    if (!pendingFocus.current || activeIndex < 0) return;
    let frame = 0;
    let attempts = 0;
    const focusRow = () => {
      const element = gridRef.current?.querySelector<HTMLElement>(
        `[data-row-index="${activeIndex}"]`,
      );
      if (element) {
        element.focus({ preventScroll: true });
        pendingFocus.current = false;
      } else if (attempts++ < 6) {
        frame = requestAnimationFrame(focusRow);
      }
    };
    frame = requestAnimationFrame(focusRow);
    return () => cancelAnimationFrame(frame);
  }, [activeIndex]);

  const activate = useCallback(
    (index: number) => {
      const link = ordered[index];
      if (!link) return;
      pendingFocus.current = true;
      setActiveId(link.id);
      virtualizer.scrollToIndex(index, { align: "auto" });
    },
    [ordered, virtualizer],
  );

  const setSelected = useCallback((ids: string[], value: boolean) => {
    setRowSelection((current) => {
      const next = { ...current };
      for (const id of ids) {
        if (value) next[id] = true;
        else delete next[id];
      }
      return next;
    });
  }, []);

  const toggleAt = useCallback(
    (index: number) => {
      const link = ordered[index];
      if (!link) return;
      setSelected([link.id], !rowSelection[link.id]);
      anchorIndex.current = index;
    },
    [ordered, rowSelection, setSelected],
  );

  const selectRangeTo = useCallback(
    (index: number) => {
      const anchor = anchorIndex.current ?? index;
      const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
      setSelected(
        ordered.slice(from, to + 1).map((link) => link.id),
        true,
      );
      anchorIndex.current ??= index;
    },
    [ordered, setSelected],
  );

  const clearSelection = useCallback(() => {
    setRowSelection({});
    anchorIndex.current = null;
  }, []);

  const copyLink = useCallback(
    async (link: LinkRow) => {
      const ok = await copyText(shortUrl(link.domain, link.key));
      if (!ok) {
        announce(t.copyFailed);
        return;
      }
      setCopiedSignal({ id: link.id, at: Date.now() });
      announce(t.copiedAnnouncement(`${link.domain}/${link.key}`));
      onCopy?.(link);
    },
    [onCopy, t],
  );

  useEffect(() => {
    if (!showRows) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        isTypingTarget(event.target)
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          '[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]',
        )
      )
        return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const inGrid = Boolean(target && gridRef.current?.contains(target));
      const onRow = Boolean(target?.hasAttribute("data-row-index"));
      const current = activeIndex;
      const step = (delta: number) => {
        const next =
          current < 0
            ? 0
            : Math.min(ordered.length - 1, Math.max(0, current + delta));
        if (event.shiftKey && current >= 0) {
          const ids = [ordered[current]?.id, ordered[next]?.id].filter(
            (id): id is string => Boolean(id),
          );
          setSelected(ids, true);
          anchorIndex.current ??= current;
        }
        activate(next);
      };

      if (!mod && (key === "j" || key === "k")) {
        event.preventDefault();
        step(key === "j" ? 1 : -1);
      } else if (inGrid && !mod && (key === "arrowdown" || key === "arrowup")) {
        event.preventDefault();
        step(key === "arrowdown" ? 1 : -1);
      } else if (inGrid && !mod && (key === "home" || key === "end")) {
        event.preventDefault();
        activate(key === "home" ? 0 : ordered.length - 1);
      } else if (inGrid && !mod && (key === "pagedown" || key === "pageup")) {
        event.preventDefault();
        const page = Math.max(
          1,
          Math.floor((scrollRef.current?.clientHeight ?? 400) / rowHeight) - 1,
        );
        step(key === "pagedown" ? page : -page);
      } else if (onRow && !mod && key === "x" && current >= 0) {
        event.preventDefault();
        if (event.shiftKey) selectRangeTo(current);
        else toggleAt(current);
      } else if (onRow && !mod && key === "enter" && current >= 0) {
        event.preventDefault();
        const link = ordered[current];
        if (link) onOpen(link, "overview");
      } else if (onRow && !mod && key === "e" && current >= 0) {
        event.preventDefault();
        const link = ordered[current];
        if (link) onOpen(link, "edit");
      } else if (inGrid && mod && key === "a") {
        event.preventDefault();
        setSelected(
          ordered.map((link) => link.id),
          true,
        );
      } else if (
        onRow &&
        mod &&
        key === "c" &&
        !window.getSelection()?.toString()
      ) {
        const link = ordered[current];
        if (link) {
          event.preventDefault();
          void copyLink(link);
        }
      } else if (
        key === "escape" &&
        selectedCount > 0 &&
        (inGrid || target === document.body)
      ) {
        event.preventDefault();
        clearSelection();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    showRows,
    activeIndex,
    ordered,
    rowHeight,
    activate,
    setSelected,
    selectRangeTo,
    toggleAt,
    onOpen,
    copyLink,
    selectedCount,
    clearSelection,
  ]);

  const handleRowClick = (
    event: MouseEvent<HTMLDivElement>,
    index: number,
    link: LinkRow,
  ) => {
    if (event.shiftKey) {
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      selectRangeTo(index);
      setActiveId(link.id);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      toggleAt(index);
      setActiveId(link.id);
      return;
    }
    setActiveId(link.id);
    onOpen(link, "overview");
  };

  const handleCheckboxClick = (
    event: MouseEvent<HTMLButtonElement>,
    index: number,
    link: LinkRow,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveId(link.id);
    if (event.shiftKey && anchorIndex.current !== null) selectRangeTo(index);
    else toggleAt(index);
  };

  const allSelected = selectedCount > 0 && selectedCount === ordered.length;
  const headerChecked = allSelected
    ? true
    : selectedCount > 0
      ? "indeterminate"
      : false;
  const toggleAll = () =>
    selectedCount > 0
      ? clearSelection()
      : setSelected(
          ordered.map((link) => link.id),
          true,
        );
  const items = virtualizer.getVirtualItems();
  const tabStopIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div
      ref={scrollRef}
      data-selecting={selectedCount > 0 || undefined}
      className={cn(
        "group/table relative min-h-0 flex-1 overflow-auto overscroll-contain",
        className,
      )}
    >
      {selectedCount > 0 && !listLayout ? (
        <div className="sticky top-0 z-30 h-0">
          <div
            role="toolbar"
            aria-label={bulkActionsLabel ?? t.selectedCount(selectedCount)}
            className="absolute inset-x-0 top-0 flex h-header-row items-center gap-1 border-b border-line bg-bg-subtle pr-[calc(var(--space-gutter)-6px)] pl-gutter"
          >
            <Checkbox
              checked={headerChecked}
              onCheckedChange={toggleAll}
              aria-label={t.selectAll}
              className="mr-3"
            />
            <span
              className="mr-3 shrink-0 text-small font-medium tabular-nums"
              aria-live="polite"
            >
              {t.selectedCount(selectedCount)}
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
              {renderBulkActions?.(selectedLinks, clearSelection)}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              shortcut="esc"
            >
              {t.clearSelection}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        ref={gridRef}
        role="grid"
        aria-label={label}
        aria-rowcount={status === "ready" ? ordered.length + 1 : -1}
        aria-colcount={visibleColumns.length}
        aria-multiselectable
        aria-busy={status === "loading" || undefined}
        className="min-w-0"
      >
        {listLayout ? null : (
          <div role="rowgroup" className="sticky top-0 z-20">
            <div
              role="row"
              aria-rowindex={1}
              inert={selectedCount > 0 || undefined}
              className="grid h-header-row items-center border-b border-line bg-bg-subtle text-meta font-medium text-fg-muted"
              style={{ gridTemplateColumns: template }}
            >
              {visibleColumns.map((id) => (
                <HeaderCell
                  key={id}
                  id={id}
                  sorting={sorting}
                  onSort={(desc) => setSorting([{ id, desc }])}
                  selectAll={
                    showRows ? (
                      <Checkbox
                        checked={headerChecked}
                        onCheckedChange={toggleAll}
                        aria-label={t.selectAll}
                        className="opacity-0 group-hover/table:opacity-100 focus-visible:opacity-100"
                      />
                    ) : null
                  }
                  columnMenu={
                    <ColumnMenu
                      visibility={columnVisibility}
                      onToggle={(column, visible) =>
                        setUserVisibility((current) => ({
                          ...current,
                          [column]: visible,
                        }))
                      }
                    />
                  }
                />
              ))}
            </div>
          </div>
        )}

        {status === "loading" ? (
          <SkeletonRows
            template={template}
            visibleColumns={visibleColumns}
            listLayout={listLayout}
            label={t.loadingLinks}
          />
        ) : status === "error" ? (
          <div role="row" aria-rowindex={2}>
            <div role="gridcell" aria-colspan={visibleColumns.length}>
              {errorState}
            </div>
          </div>
        ) : ordered.length === 0 ? (
          <div role="row" aria-rowindex={2}>
            <div role="gridcell" aria-colspan={visibleColumns.length}>
              {emptyState}
            </div>
          </div>
        ) : (
          <div
            role="rowgroup"
            className="relative"
            style={{
              height:
                virtualizer.getTotalSize() - (listLayout ? 0 : HEADER_HEIGHT),
            }}
          >
            {items.map((item) => {
              const link = ordered[item.index];
              if (!link) return null;
              const selected = Boolean(rowSelection[link.id]);
              const isActive = item.index === activeIndex;
              const copiedAt =
                copiedSignal?.id === link.id
                  ? copiedSignal.at
                  : fresh?.id === link.id
                    ? fresh.at
                    : undefined;
              const shared = {
                link,
                index: item.index,
                selected,
                isActive,
                tabbable: item.index === tabStopIndex,
                copiedAt,
                isFresh: fresh?.id === link.id,
                now,
                intlLocale,
                onClick: handleRowClick,
                onFocus: () => setActiveId(link.id),
                onCopy: () => onCopy?.(link),
                style: {
                  transform: `translateY(${item.start - (listLayout ? 0 : HEADER_HEIGHT)}px)`,
                  height: item.size,
                },
              };
              return listLayout ? (
                <ListRow key={item.key} {...shared} />
              ) : (
                <TableRow
                  key={item.key}
                  {...shared}
                  template={template}
                  visibleColumns={visibleColumns}
                  onCheckboxClick={handleCheckboxClick}
                  rowActions={renderRowActions?.(link)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface HeaderCellProps {
  id: LinkColumnId;
  sorting: SortingState;
  onSort: (desc: boolean) => void;
  selectAll: ReactNode;
  columnMenu: ReactNode;
}

function HeaderCell({
  id,
  sorting,
  onSort,
  selectAll,
  columnMenu,
}: HeaderCellProps) {
  const { t } = useUILocale();
  const sort = sorting.find((entry) => entry.id === id);
  const ariaSort = sort ? (sort.desc ? "descending" : "ascending") : undefined;
  const labels: Partial<Record<LinkColumnId, string>> = {
    link: t.columnLink,
    destination: t.columnDestination,
    tags: t.columnTags,
    trend: t.columnTrend,
    clicks: t.columnClicks,
    created: t.columnCreated,
  };

  if (id === "select") {
    return (
      <div role="columnheader" className="flex h-full items-center pl-gutter">
        {selectAll}
      </div>
    );
  }
  if (id === "actions") {
    return (
      <div
        role="columnheader"
        aria-label={t.columns}
        className="flex h-full items-center justify-end pr-[calc(var(--space-gutter)-6px)]"
      >
        {columnMenu}
      </div>
    );
  }

  const numeric = id === "clicks" || id === "created";
  const sortable = numeric;
  return (
    <div
      role="columnheader"
      aria-sort={ariaSort}
      className={cn(
        "flex h-full min-w-0 items-center",
        id === "link" ? "pr-cell" : "px-cell",
        numeric && "justify-end",
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(sort ? !sort.desc : true)}
          className={cn(
            "-mx-1 inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-chip px-1 py-0.5 hover:text-fg",
            sort && "text-fg",
          )}
          aria-label={`${labels[id]}, ${sort?.desc ? t.sortAscending : t.sortDescending}`}
        >
          {sort ? (
            sort.desc ? (
              <ArrowDown aria-hidden className="size-3" />
            ) : (
              <ArrowUp aria-hidden className="size-3" />
            )
          ) : null}
          <span className="truncate">{labels[id]}</span>
        </button>
      ) : (
        <span className="truncate">{labels[id]}</span>
      )}
    </div>
  );
}

function ColumnMenu({
  visibility,
  onToggle,
}: {
  visibility: VisibilityState;
  onToggle: (column: string, visible: boolean) => void;
}) {
  const { t } = useUILocale();
  const labels: Record<(typeof HIDEABLE_COLUMNS)[number], string> = {
    destination: t.columnDestination,
    tags: t.columnTags,
    trend: t.columnTrend,
    clicks: t.columnClicks,
    created: t.columnCreated,
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t.columns}
          tooltip={t.columns}
        >
          <Columns3 aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
        {HIDEABLE_COLUMNS.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={visibility[column] !== false}
            onCheckedChange={(checked) => onToggle(column, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {labels[column]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface RowSharedProps {
  link: LinkRow;
  index: number;
  selected: boolean;
  isActive: boolean;
  tabbable: boolean;
  copiedAt: number | undefined;
  isFresh: boolean;
  now: Date;
  intlLocale: string;
  onClick: (
    event: MouseEvent<HTMLDivElement>,
    index: number,
    link: LinkRow,
  ) => void;
  onFocus: () => void;
  onCopy: () => void;
  style: { transform: string; height: number };
}

const rowBase = [
  "group absolute inset-x-0 top-0 cursor-default border-b border-line select-none",
  "hover:bg-bg-subtle aria-selected:bg-bg-muted",
  "focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal",
].join(" ");

function useRowLabels(link: LinkRow, now: Date, intlLocale: string) {
  const { t } = useUILocale();
  const created = new Date(link.createdAt);
  const total = link.trend.reduce((sum, value) => sum + value, 0);
  const peak = Math.max(0, ...link.trend);
  return {
    age: formatAge(created, now, t.ageUnits),
    createdFull: formatDate(created, intlLocale, true),
    clicks: formatNumber(link.clicks, intlLocale),
    trendLabel:
      total === 0
        ? t.noClicksYet
        : t.trendLabel(
            formatNumber(total, intlLocale),
            formatNumber(peak, intlLocale),
          ),
  };
}

function TableRow({
  link,
  index,
  selected,
  tabbable,
  isActive,
  copiedAt,
  isFresh,
  now,
  intlLocale,
  onClick,
  onFocus,
  onCopy,
  style,
  template,
  visibleColumns,
  onCheckboxClick,
  rowActions,
}: RowSharedProps & {
  template: string;
  visibleColumns: LinkColumnId[];
  onCheckboxClick: (
    event: MouseEvent<HTMLButtonElement>,
    index: number,
    link: LinkRow,
  ) => void;
  rowActions: ReactNode;
}) {
  const { t } = useUILocale();
  const labels = useRowLabels(link, now, intlLocale);
  const { host } = parseDestination(link.url);
  const innerTab = isActive ? 0 : -1;

  const cell = (id: LinkColumnId): ReactNode => {
    switch (id) {
      case "select":
        return (
          <div
            role="gridcell"
            className="relative flex h-full items-center pl-gutter"
          >
            <span className="grid size-4 place-items-center group-hover:hidden group-focus-within:hidden group-aria-selected:hidden group-data-selecting/table:hidden">
              <Favicon host={host} src={link.faviconSrc} />
            </span>
            <Checkbox
              checked={selected}
              tabIndex={innerTab}
              aria-label={t.selectRow(`${link.domain}/${link.key}`)}
              onClick={(event) => onCheckboxClick(event, index, link)}
              className="hidden group-hover:grid group-focus-within:grid group-aria-selected:grid group-data-selecting/table:grid"
            />
          </div>
        );
      case "link":
        return (
          <div
            role="gridcell"
            className="flex h-full min-w-0 items-center pr-cell"
          >
            <ShortLink
              domain={link.domain}
              linkKey={link.key}
              reveal="hover"
              copiedAt={copiedAt}
              onCopy={onCopy}
              tabIndex={innerTab}
            />
          </div>
        );
      case "destination":
        return (
          <div
            role="gridcell"
            className="flex h-full min-w-0 items-center px-cell"
          >
            <Destination url={link.url} showFavicon={false} />
          </div>
        );
      case "tags":
        return (
          <div
            role="gridcell"
            className="flex h-full min-w-0 items-center px-cell"
          >
            <TagChips tags={link.tags} />
          </div>
        );
      case "trend":
        return (
          <div role="gridcell" className="flex h-full items-center px-cell">
            <Sparkline
              data={link.trend}
              width={76}
              height={20}
              label={labels.trendLabel}
            />
          </div>
        );
      case "clicks":
        return (
          <div
            role="gridcell"
            className="flex h-full items-center justify-end px-cell font-mono text-small text-fg tabular-nums"
          >
            {labels.clicks}
          </div>
        );
      case "created":
        return (
          <div
            role="gridcell"
            className="flex h-full items-center justify-end px-cell font-mono text-small text-fg-muted tabular-nums"
          >
            <Tooltip content={labels.createdFull} side="left">
              <time dateTime={link.createdAt}>{labels.age}</time>
            </Tooltip>
          </div>
        );
      case "actions":
        return (
          <div
            role="gridcell"
            className="flex h-full items-center justify-end pr-[calc(var(--space-gutter)-6px)]"
          >
            {rowActions ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    tabIndex={innerTab}
                    aria-label={`${link.domain}/${link.key}`}
                    onClick={(event) => event.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100"
                  >
                    <Ellipsis aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(event) => event.stopPropagation()}
                  className="min-w-52"
                >
                  {rowActions}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        );
    }
  };

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      data-row-index={index}
      data-active={isActive || undefined}
      onClick={(event) => onClick(event, index, link)}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus();
      }}
      className={cn(
        rowBase,
        "grid items-center",
        isFresh && "animate-fresh-row",
      )}
      style={{ ...style, gridTemplateColumns: template }}
    >
      {visibleColumns.map((id) => (
        <Fragment key={id}>{cell(id)}</Fragment>
      ))}
    </div>
  );
}

function ListRow({
  link,
  index,
  selected,
  tabbable,
  isActive,
  copiedAt,
  isFresh,
  now,
  intlLocale,
  onClick,
  onFocus,
  onCopy,
  style,
}: RowSharedProps) {
  const labels = useRowLabels(link, now, intlLocale);
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      data-row-index={index}
      onClick={(event) => onClick(event, index, link)}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus();
      }}
      className={cn(
        rowBase,
        "flex flex-col justify-center gap-1 px-gutter",
        isFresh && "animate-fresh-row",
      )}
      style={style}
    >
      <div
        role="gridcell"
        className="flex min-w-0 items-center justify-between gap-3"
      >
        <ShortLink
          domain={link.domain}
          linkKey={link.key}
          copiedAt={copiedAt}
          onCopy={onCopy}
          tabIndex={isActive ? 0 : -1}
          className="min-w-0"
        />
        <span className="shrink-0 font-mono text-small text-fg tabular-nums">
          {labels.clicks}
        </span>
      </div>
      <div
        role="gridcell"
        className="flex min-w-0 items-center justify-between gap-3"
      >
        <Destination
          url={link.url}
          faviconSrc={link.faviconSrc}
          showFullOnHover={false}
          className="min-w-0 [&_img]:size-3.5 [&_svg]:size-3.5"
        />
        <time
          dateTime={link.createdAt}
          className="shrink-0 font-mono text-meta text-fg-muted tabular-nums"
        >
          {labels.age}
        </time>
      </div>
    </div>
  );
}

const SKELETON_WIDTHS = [
  [58, 72, 2],
  [44, 64, 1],
  [66, 80, 2],
  [38, 56, 0],
  [52, 76, 1],
  [70, 60, 2],
  [47, 84, 1],
  [61, 52, 0],
] as const;

function SkeletonRows({
  template,
  visibleColumns,
  listLayout,
  label,
}: {
  template: string;
  visibleColumns: LinkColumnId[];
  listLayout: boolean;
  label: string;
}) {
  return (
    <div role="rowgroup" aria-label={label}>
      {Array.from({ length: 14 }, (_, index) => {
        const [linkWidth, destWidth, tagCount] =
          SKELETON_WIDTHS[index % SKELETON_WIDTHS.length] ?? SKELETON_WIDTHS[0];
        if (listLayout) {
          return (
            <div
              key={index}
              role="row"
              className="flex h-15 flex-col justify-center gap-2 border-b border-line px-gutter"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3" style={{ width: `${linkWidth}%` }} />
                <Skeleton className="h-3 w-10" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton
                  className="h-2.5"
                  style={{ width: `${destWidth}%` }}
                />
                <Skeleton className="h-2.5 w-6" />
              </div>
            </div>
          );
        }
        return (
          <div
            key={index}
            role="row"
            className="grid h-row items-center border-b border-line"
            style={{ gridTemplateColumns: template }}
          >
            {visibleColumns.map((id) => (
              <div
                key={id}
                role="gridcell"
                className={cn(
                  "flex h-full min-w-0 items-center",
                  id === "select"
                    ? "pl-gutter"
                    : id === "link"
                      ? "pr-cell"
                      : "px-cell",
                  (id === "clicks" || id === "created") && "justify-end",
                )}
              >
                {id === "select" ? (
                  <Skeleton className="size-4 rounded-full" />
                ) : null}
                {id === "link" ? (
                  <Skeleton
                    className="h-3"
                    style={{ width: `${linkWidth}%` }}
                  />
                ) : null}
                {id === "destination" ? (
                  <Skeleton
                    className="h-3"
                    style={{ width: `${destWidth}%` }}
                  />
                ) : null}
                {id === "tags" ? (
                  <span className="flex gap-1">
                    {Array.from({ length: tagCount }, (_, tag) => (
                      <Skeleton key={tag} className="h-5 w-14" />
                    ))}
                  </span>
                ) : null}
                {id === "trend" ? <Skeleton className="h-3 w-[76px]" /> : null}
                {id === "clicks" ? <Skeleton className="h-3 w-12" /> : null}
                {id === "created" ? <Skeleton className="h-3 w-7" /> : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
