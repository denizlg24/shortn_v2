"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { BioLinkItem, BioResolvedLink } from "@shortn/core/bio-content";
import {
  searchBioLinksAction,
  selectBioLinksAction,
  shortenBioContentAction,
} from "@/server/actions/bio-publishing";
import { buttonVariants } from "@shortn/ui";
import { LinkToolbar } from "../link-filters/toolbar";
import {
  emptyLinkFilters,
  linkFiltersSearch,
  type LinkFilterState,
} from "../link-filters/state";
import { linkFacetOptionsAction } from "@/server/actions/link-filters";
import { FilterField } from "../page/filters";
import { ImageUpload } from "../page/image-upload";
import { linkSorts, moveAmong, sortLinks, type LinkSort } from "./link-sort";
const input =
  "min-h-10 w-full rounded-control border border-line-strong bg-bg px-3 py-2 text-small";
type LibraryLink = Awaited<
  ReturnType<typeof searchBioLinksAction>
>["links"][number];
const button = buttonVariants({ variant: "secondary", size: "md" });
const filterControl =
  "h-8 min-w-0 w-full rounded-control border border-line-strong bg-field px-2.5 text-small text-fg focus-visible:outline-2 focus-visible:outline-signal";
function LinkRow({
  item,
  title,
  children,
}: {
  item: BioLinkItem;
  title: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("bio.editor");
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="studio-link-row flex min-w-0 flex-wrap items-center gap-2 border-b border-line py-3"
    >
      <button
        type="button"
        className="min-h-10 min-w-10 touch-none text-fg-muted"
        aria-label={t("reorder", { title })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="mx-auto size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate text-small">{title}</span>
      <div className="studio-link-actions">{children}</div>
    </div>
  );
}
export function LinkManager({
  workspace,
  bioId,
  items,
  links,
  onChange,
  onResolve,
  onBusyChange,
  uploading,
  chooseOnly = false,
  startWithLibrary = false,
}: {
  workspace: string;
  bioId: string;
  items: BioLinkItem[];
  links: Record<string, BioResolvedLink>;
  onChange: (items: BioLinkItem[]) => void;
  onResolve: (id: string, link: BioResolvedLink) => void;
  onBusyChange: (busy: boolean) => void;
  uploading: boolean;
  chooseOnly?: boolean;
  startWithLibrary?: boolean;
}) {
  const t = useTranslations("bio.editor");
  const [mode, setMode] = useState<"manage" | "existing" | "create">(
    chooseOnly || startWithLibrary || !items.length ? "existing" : "manage",
  );
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<string | null>(null);
  const [library, setLibrary] = useState<Awaited<
    ReturnType<typeof searchBioLinksAction>
  > | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [filters, setFilters] = useState<LinkFilterState>({
    ...emptyLinkFilters,
    group: "tag",
  });
  const tags = filters.tags,
    groupBy = filters.group,
    query = linkFiltersSearch(filters).toString();
  const [setup, setSetup] = useState<{
    domains: string[];
    campaigns: boolean;
  } | null>(null);
  const [selection, setSelection] = useState<Record<string, LibraryLink>>({});
  const [sorted, setSorted] = useState<{
    order: LinkSort;
    previous: string[];
  } | null>(null);
  const [position, setPosition] = useState("");
  const [selecting, setSelecting] = useState(false);
  useEffect(() => {
    let live = true;
    void linkFacetOptionsAction(workspace)
      .then((value) => {
        if (live) setSetup(value);
      })
      .catch(() => {
        if (live) setSetup({ domains: [], campaigns: false });
      });
    return () => {
      live = false;
    };
  }, [workspace]);
  const [url, setUrl] = useState(""),
    [title, setTitle] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    if (mode !== "existing") return;
    let live = true;
    const timer = setTimeout(() => {
      setPending(true);
      setError("");
      void searchBioLinksAction(workspace, filters.search, page, tags, query)
        .then((value) => {
          if (live) setLibrary(value);
        })
        .catch(() => {
          if (live) setError(t("libraryFailed"));
        })
        .finally(() => {
          if (live) setPending(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [workspace, filters.search, page, mode, tags, query, t]);
  function navigate(next: typeof mode) {
    setMode(next);
    setSearch("");
    setPage(1);
    setEditing(null);
    setError("");
    setLibrary(null);
    setFilters({ ...emptyLinkFilters, group: "tag" });
    setSelection({});
  }
  function add(link: { id: string; title: string; href: string }) {
    onResolve(link.id, { title: link.title, href: link.href });
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        linkId: link.id,
        title: link.title,
        visible: true,
        image: "",
        highlight: false,
      },
    ]);
    if (!chooseOnly) navigate("manage");
  }
  const alreadyAdded = new Set(items.map((item) => item.linkId));
  const selectedLinks = Object.values(selection).filter(
    (link) => !alreadyAdded.has(link.id),
  );
  const capacity = Math.max(0, 1000 - items.length - selectedLinks.length);
  function toggleLinks(candidates: LibraryLink[], checked: boolean) {
    setSelection((current) => {
      const next = { ...current };
      for (const link of candidates) {
        if (!checked) delete next[link.id];
        else if (
          !alreadyAdded.has(link.id) &&
          Object.keys(next).length < 1000 - items.length
        )
          next[link.id] = link;
      }
      return next;
    });
  }
  async function selectAll() {
    setSelecting(true);
    setError("");
    onBusyChange(true);
    try {
      const matches = await selectBioLinksAction(
        workspace,
        filters.search,
        tags,
        [...alreadyAdded, ...Object.keys(selection)],
        capacity,
        query,
      );
      toggleLinks(matches, true);
    } catch {
      setError(t("libraryFailed"));
    } finally {
      setSelecting(false);
      onBusyChange(false);
    }
  }
  function addSelected() {
    const additions = selectedLinks.slice(0, Math.max(0, 1000 - items.length));
    for (const link of additions)
      onResolve(link.id, { title: link.title, href: link.href });
    onChange([
      ...items,
      ...additions.map((link) => ({
        id: crypto.randomUUID(),
        linkId: link.id,
        title: link.title,
        visible: true,
        image: "",
        highlight: false,
      })),
    ]);
    navigate("manage");
  }
  async function create() {
    setPending(true);
    setError("");
    onBusyChange(true);
    try {
      const result = await shortenBioContentAction(
        workspace,
        bioId,
        url,
        title,
      );
      if (!result.ok) {
        setError(t("status.shortenFailed"));
        return;
      }
      const link = result.value,
        protocol = Object.values(links)[0]?.href.startsWith("http:")
          ? "http:"
          : window.location.protocol;
      add({
        id: link.id,
        title: link.title || link.key,
        href: `${protocol}//${link.domain}/${link.key}`,
      });
      setUrl("");
      setTitle("");
    } catch {
      setError(t("status.shortenFailed"));
    } finally {
      setPending(false);
      onBusyChange(false);
    }
  }
  const filtered = items.filter((item) =>
    `${item.title} ${links[item.linkId]?.title ?? ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const pages =
    mode === "existing"
      ? (library?.pages ?? 1)
      : Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages),
    visible = filtered.slice((current - 1) * 20, current * 20);
  const selected = items.find((item) => item.id === editing);
  const update = (patch: Partial<BioLinkItem>) =>
    onChange(
      items.map((item) => (item.id === editing ? { ...item, ...patch } : item)),
    );
  function move(id: string, delta: number) {
    const at = items.findIndex((i) => i.id === id),
      to = at + delta;
    if (to >= 0 && to < items.length) onChange(arrayMove(items, at, to));
  }
  function moveTo(id: string, to: number) {
    const at = items.findIndex((i) => i.id === id),
      target = Math.min(Math.max(to, 0), items.length - 1);
    if (at < 0 || at === target) return;
    onChange(arrayMove(items, at, target));
    setPosition("");
    setSorted(null);
    if (!search) setPage(Math.floor(target / 20) + 1);
  }
  const titleOf = (item: BioLinkItem) =>
    item.title || links[item.linkId]?.title || "";
  function sortBy(order: LinkSort) {
    setSorted({ order, previous: items.map((item) => item.id) });
    onChange(sortLinks(items, order, titleOf));
    setPage(1);
  }
  const groups = new Map<string, LibraryLink[]>();
  for (const link of library?.links ?? []) {
    const name =
      groupBy === "tag"
        ? ((link.tags ?? []).find((tag) => tags.includes(tag)) ??
          link.tags?.[0] ??
          t("untagged"))
        : "";
    groups.set(name, [...(groups.get(name) ?? []), link]);
  }
  return (
    <div className="studio-link-manager grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {mode !== "manage" && !chooseOnly ? (
          <button
            className={button}
            type="button"
            disabled={pending || uploading}
            onClick={() => navigate("manage")}
          >
            {t("backToLinks")}
          </button>
        ) : null}
        {mode === "manage" ? (
          <>
            <p className="flex-1 text-small text-fg-muted">
              {t("linkTotal", { count: items.length })}
            </p>
            <button
              className={button}
              type="button"
              disabled={items.length >= 1000 || uploading}
              onClick={() => navigate("existing")}
            >
              <Plus className="size-4" />
              {t("addLink")}
            </button>
          </>
        ) : (
          <>
            <button
              className={button}
              type="button"
              disabled={uploading || pending}
              aria-pressed={mode === "existing"}
              onClick={() => navigate("existing")}
            >
              {t("existingLink")}
            </button>
            <button
              className={button}
              type="button"
              disabled={uploading || pending}
              aria-pressed={mode === "create"}
              onClick={() => navigate("create")}
            >
              {t("newLink")}
            </button>
          </>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      {mode === "create" ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <label className="grid gap-1 text-small">
            {t("inlineUrl")}
            <input
              required
              type="url"
              className={input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-small">
            {t("title")}
            <input
              maxLength={120}
              className={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button className={button} disabled={pending || !url} type="submit">
            {pending ? t("working") : t("shorten")}
          </button>
        </form>
      ) : (
        <>
          {mode === "manage" ? (
            <div className="grid min-w-0 gap-3">
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
                <FilterField
                  label={t("searchLinks")}
                  className="w-full min-w-0"
                >
                  {(id) => (
                    <input
                      id={id}
                      type="search"
                      maxLength={200}
                      className={filterControl}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  )}
                </FilterField>
                <FilterField label={t("sortLinks")} className="w-full min-w-0">
                  {(id) => (
                    <select
                      id={id}
                      className={filterControl}
                      value=""
                      disabled={items.length < 2 || uploading}
                      onChange={(event) => {
                        const order = linkSorts.find(
                          (value) => value === event.target.value,
                        );
                        if (order) sortBy(order);
                      }}
                    >
                      <option value="">{t("sortCustom")}</option>
                      {linkSorts.map((order) => (
                        <option key={order} value={order}>
                          {t(`sorts.${order}`)}
                        </option>
                      ))}
                    </select>
                  )}
                </FilterField>
              </div>
              {sorted ? (
                <p
                  role="status"
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-fg-muted"
                >
                  {t("sortedBy", { order: t(`sorts.${sorted.order}`) })}
                  <button
                    type="button"
                    className="text-signal underline-offset-4 hover:underline"
                    onClick={() => {
                      const rank = new Map(
                        sorted.previous.map((id, at) => [id, at]),
                      );
                      onChange(
                        [...items].sort(
                          (a, b) =>
                            (rank.get(a.id) ?? items.length) -
                            (rank.get(b.id) ?? items.length),
                        ),
                      );
                      setSorted(null);
                    }}
                  >
                    {t("undoSort")}
                  </button>
                </p>
              ) : search ? (
                <p className="text-small text-fg-muted">
                  {t("searchOrderHint")}
                </p>
              ) : null}
            </div>
          ) : null}
          {mode === "existing" ? (
            <>
              <LinkToolbar
                workspace={workspace}
                value={filters}
                onChange={(next) => {
                  setFilters(next);
                  setPage(1);
                  setLibrary(null);
                }}
                facets={
                  setup?.campaigns
                    ? ["tags", "status", "domain", "campaign", "created"]
                    : ["tags", "status", "domain", "created"]
                }
                domains={setup?.domains ?? []}
                countView={null}
                pending={pending || selecting}
                grouping
              />
              {!chooseOnly ? (
                <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
                  <p className="basis-full text-small text-fg-muted">
                    {t("libraryTotal", { count: library?.total ?? 0 })} ·{" "}
                    {t("selectedTotal", { count: selectedLinks.length })}
                  </p>
                  <button
                    type="button"
                    className={button}
                    disabled={pending || !library || !capacity || selecting}
                    onClick={() => toggleLinks(library?.links ?? [], true)}
                  >
                    {t("selectPage")}
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={
                      pending || !library?.total || !capacity || selecting
                    }
                    onClick={() => void selectAll()}
                  >
                    {selecting ? t("working") : t("selectResults")}
                  </button>
                  {selectedLinks.length ? (
                    <>
                      <button
                        type="button"
                        className={button}
                        disabled={selecting}
                        onClick={() => setSelection({})}
                      >
                        {t("clearSelection")}
                      </button>
                      <button
                        type="button"
                        className="studio-primary"
                        disabled={selecting}
                        onClick={addSelected}
                      >
                        {t("addSelected", { count: selectedLinks.length })}
                      </button>
                    </>
                  ) : null}
                  <p className="basis-full text-small text-fg-muted">
                    {t("selectionHint", {
                      count: Math.max(0, 1000 - items.length),
                    })}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
          {selected && mode === "manage" ? (
            <fieldset
              disabled={uploading}
              className="grid gap-4 border-b border-line pb-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t("editLink")}</h3>
                <button
                  className={button}
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  {t("done")}
                </button>
              </div>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const to = Number(position);
                  if (Number.isInteger(to) && to >= 1)
                    moveTo(selected.id, to - 1);
                }}
              >
                <label className="grid gap-1 text-small">
                  {t("position", { total: items.length })}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={items.length}
                    className={`${input} w-28`}
                    placeholder={String(
                      items.findIndex((item) => item.id === selected.id) + 1,
                    )}
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </label>
                <button className={button} type="submit" disabled={!position}>
                  {t("moveTo")}
                </button>
                <button
                  className={button}
                  type="button"
                  disabled={items[0]?.id === selected.id}
                  onClick={() => moveTo(selected.id, 0)}
                >
                  {t("moveTop")}
                </button>
                <button
                  className={button}
                  type="button"
                  disabled={items.at(-1)?.id === selected.id}
                  onClick={() => moveTo(selected.id, items.length - 1)}
                >
                  {t("moveBottom")}
                </button>
              </form>
              <label className="grid gap-1 text-small">
                {t("title")}
                <input
                  className={input}
                  value={selected.title}
                  maxLength={120}
                  onChange={(e) => update({ title: e.target.value })}
                />
              </label>
              <ImageUpload
                key={selected.id}
                label={t("image")}
                value={selected.image}
                onChange={(image) => update({ image })}
                onBusyChange={onBusyChange}
              />
              <label className="text-small">
                <input
                  type="checkbox"
                  checked={selected.highlight}
                  onChange={(e) => update({ highlight: e.target.checked })}
                />{" "}
                {t("highlight")}
              </label>
              <label className="text-small">
                <input
                  type="checkbox"
                  checked={selected.visible}
                  onChange={(e) => update({ visible: e.target.checked })}
                />{" "}
                {t("visible")}
              </label>
            </fieldset>
          ) : null}
          {mode === "existing" ? (
            <div aria-busy={pending || selecting}>
              {pending || (!library && !error) ? (
                <p role="status" className="py-6 text-small text-fg-muted">
                  {t("working")}
                </p>
              ) : library?.links.length ? (
                [...groups].map(([name, group]) => (
                  <section key={name} aria-label={name || undefined}>
                    {name ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3">
                        <h3 className="text-small font-medium">{name}</h3>
                        {!chooseOnly ? (
                          <button
                            type="button"
                            className={button}
                            disabled={selecting || !capacity}
                            onClick={() => toggleLinks(group, true)}
                          >
                            {t("selectGroupPage")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <table className="studio-library-table w-full table-fixed text-left text-small">
                      <thead className="border-b border-line text-meta text-fg-muted">
                        <tr>
                          {!chooseOnly ? (
                            <th className="w-8 py-2">
                              <span className="sr-only">{t("selectPage")}</span>
                            </th>
                          ) : null}
                          <th scope="col" className="py-2 pr-3 font-medium">
                            {t("types.link")}
                          </th>
                          <th
                            scope="col"
                            className="studio-library-tags w-32 py-2 font-medium"
                          >
                            {t("tagColumn")}
                          </th>
                          <th className="w-16 py-2">
                            <span className="sr-only">{t("addLink")}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {group.map((link) => (
                          <tr key={link.id} className="hover:bg-bg-subtle">
                            {!chooseOnly ? (
                              <td className="py-2.5 pr-2">
                                <input
                                  type="checkbox"
                                  className="size-4 shrink-0 accent-[var(--color-signal)]"
                                  aria-label={t("selectLink", {
                                    title: link.title,
                                  })}
                                  checked={
                                    alreadyAdded.has(link.id) ||
                                    Boolean(selection[link.id])
                                  }
                                  disabled={
                                    alreadyAdded.has(link.id) ||
                                    selecting ||
                                    (!selection[link.id] && !capacity)
                                  }
                                  onChange={(e) =>
                                    toggleLinks([link], e.target.checked)
                                  }
                                />
                              </td>
                            ) : null}
                            <td className="min-w-0 py-2.5 pr-3">
                              <p
                                className="truncate font-medium"
                                title={link.title}
                              >
                                {link.title}
                              </p>
                              <p
                                className="truncate text-meta text-fg-muted"
                                title={link.href}
                              >
                                {link.href}
                              </p>
                            </td>
                            <td className="studio-library-tags py-2.5 pr-2">
                              <div className="flex min-w-0 flex-wrap gap-1">
                                {(link.tags ?? []).map((tag) => (
                                  <span
                                    key={tag}
                                    className="max-w-full truncate rounded-chip bg-bg-muted px-1.5 py-0.5 text-meta"
                                    title={tag}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 text-right">
                              {alreadyAdded.has(link.id) ? (
                                <span className="text-meta text-fg-muted">
                                  {t("added")}
                                </span>
                              ) : chooseOnly ? (
                                <button
                                  className={button}
                                  type="button"
                                  onClick={() => add(link)}
                                >
                                  {t("addLink")}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))
              ) : !error ? (
                <p className="py-6 text-small text-fg-muted">{t("noLinks")}</p>
              ) : null}
            </div>
          ) : (
            <DndContext
              id={`bio-link-manager-${bioId}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                setSorted(null);
                onChange(
                  moveAmong(
                    items,
                    filtered.map((i) => i.id),
                    String(active.id),
                    String(over.id),
                  ),
                );
              }}
            >
              <SortableContext
                items={visible.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div>
                  {visible.map((item) => (
                    <LinkRow
                      key={item.id}
                      item={item}
                      title={
                        item.title ||
                        links[item.linkId]?.title ||
                        t("types.link")
                      }
                    >
                      <button
                        className={button}
                        aria-label={t("editLink")}
                        disabled={uploading}
                        type="button"
                        onClick={() => {
                          setEditing(item.id);
                          setPosition("");
                        }}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        className={button}
                        aria-label={t("up")}
                        disabled={items[0]?.id === item.id || uploading}
                        type="button"
                        onClick={() => {
                          setSorted(null);
                          move(item.id, -1);
                        }}
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        className={button}
                        aria-label={t("down")}
                        disabled={items.at(-1)?.id === item.id || uploading}
                        type="button"
                        onClick={() => {
                          setSorted(null);
                          move(item.id, 1);
                        }}
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        className={button}
                        aria-label={t("remove")}
                        disabled={uploading}
                        type="button"
                        onClick={() => {
                          onChange(items.filter((i) => i.id !== item.id));
                          if (editing === item.id) setEditing(null);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </LinkRow>
                  ))}
                  {!visible.length ? (
                    <p className="py-6 text-small text-fg-muted">
                      {t("noLinks")}
                    </p>
                  ) : null}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {pages > 1 ? (
            <nav
              className="flex items-center justify-between gap-2 text-small"
              aria-label={t("linkPages")}
            >
              <button
                className={button}
                type="button"
                disabled={current <= 1 || pending || uploading}
                onClick={() => {
                  setPage(current - 1);
                  if (mode === "existing") setLibrary(null);
                }}
              >
                {t("previous")}
              </button>
              <span className="tabular-nums">
                {current} / {pages}
              </span>
              <button
                className={button}
                type="button"
                disabled={current >= pages || pending || uploading}
                onClick={() => {
                  setPage(current + 1);
                  if (mode === "existing") setLibrary(null);
                }}
              >
                {t("next")}
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
