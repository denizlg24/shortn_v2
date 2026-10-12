"use client";

import type { LinkView } from "@shortn/core";
import { buttonVariants, Combobox } from "@shortn/ui";
import { ChevronsUpDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { listTagsAction } from "@/server/actions/links";
import {
  searchLinkLibraryAction,
  selectLinkLibraryAction,
} from "@/server/actions/link-library";
import { FilterField } from "../page/filters";

const button = buttonVariants({ variant: "secondary", size: "md" });
const control =
  "h-8 min-w-0 w-full rounded-control border border-line-strong bg-field px-2.5 text-small text-fg focus-visible:outline-2 focus-visible:outline-signal";

/** A bounded, in-page workspace library; choices survive pages and filters. */
export function CampaignLinkSelector({
  workspace,
  selected,
  onChange,
  onOpenChange,
  disabled,
}: {
  workspace: string;
  selected: LinkView[];
  onChange: (links: LinkView[]) => void;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
}) {
  const t = useTranslations("campaigns.library");
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [tags, setTags] = useState<string[]>([]),
    [groupBy, setGroupBy] = useState("tag");
  const [choices, setChoices] = useState<Record<string, LinkView>>({});
  const [tagOptions, setTagOptions] = useState<
    Awaited<ReturnType<typeof listTagsAction>>
  >([]);
  const [tagError, setTagError] = useState(false),
    [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data: Awaited<ReturnType<typeof searchLinkLibraryAction>>;
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const key = JSON.stringify([search.trim(), tags, page]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void listTagsAction(workspace)
      .then((value) => {
        if (live) {
          setTagOptions(value);
          setTagError(false);
        }
      })
      .catch(() => {
        if (live) setTagError(true);
      });
    return () => {
      live = false;
    };
  }, [open, workspace, retry]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => {
      void searchLinkLibraryAction(workspace, {
        search: search.trim(),
        tags,
        page,
      })
        .then((data) => {
          if (live) {
            setResult({ key, data });
            setError("");
          }
        })
        .catch(() => {
          if (live) setError(key);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, workspace, search, tags, page, key, retry]);
  const data = result?.key === key ? result.data : null;
  const loading = !data && error !== key;
  const count = Object.keys(choices).length;
  function choose(links: LinkView[], checked: boolean) {
    setChoices((current) => {
      const next = { ...current };
      for (const link of links) {
        if (!checked) delete next[link.id];
        else if (Object.keys(next).length < 500) next[link.id] = link;
      }
      return next;
    });
  }
  async function chooseAll() {
    setBusy(true);
    try {
      choose(
        await selectLinkLibraryAction(workspace, {
          search: search.trim(),
          tags,
          excluded: Object.keys(choices),
          capacity: 500 - count,
        }),
        true,
      );
    } catch {
      setError(key);
    } finally {
      setBusy(false);
    }
  }
  const groups = new Map<string, LinkView[]>();
  for (const link of data?.links ?? []) {
    const name =
      groupBy === "tag"
        ? (link.tags.find((tag) => tags.includes(tag.name))?.name ??
          link.tags[0]?.name ??
          t("untagged"))
        : "";
    groups.set(name, [...(groups.get(name) ?? []), link]);
  }
  return (
    <div className="min-w-0" data-link-library>
      <button
        type="button"
        className={button}
        disabled={disabled || busy}
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            setChoices(
              Object.fromEntries(selected.map((link) => [link.id, link])),
            );
            setSearch("");
            setTags([]);
            setPage(1);
            setResult(null);
            setError("");
          }
          setOpen(!open);
          onOpenChange(!open);
        }}
      >
        {t("browse")}
      </button>
      {open ? (
        <section
          aria-label={t("title")}
          className="mt-4 min-w-0 border-y border-line py-4"
        >
          <fieldset disabled={disabled || busy} className="grid min-w-0 gap-4">
            <div className="flex min-w-0 flex-wrap items-end gap-3">
              <FilterField label={t("search")} className="min-w-0 w-full">
                {(id) => (
                  <input
                    id={id}
                    type="search"
                    maxLength={200}
                    className={control}
                    value={search}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.preventDefault();
                    }}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                )}
              </FilterField>
              <FilterField
                label={t("tags")}
                className="min-w-0 w-full sm:flex-1"
              >
                {(id) => (
                  <Combobox
                    id={id}
                    multiple
                    options={tagOptions.map((tag) => ({
                      value: tag.name,
                      label: tag.name,
                    }))}
                    value={tags}
                    placeholder={t("anyTag")}
                    searchPlaceholder={t("searchTags")}
                    emptyText={t("noTags")}
                    trigger={
                      <button
                        id={id}
                        type="button"
                        role="combobox"
                        className={`${control} flex max-w-full items-center gap-2 overflow-hidden`}
                      >
                        <span className="min-w-0 flex-1 truncate text-left">
                          {tags.length > 1
                            ? t("tagCount", { count: tags.length })
                            : (tags[0] ?? t("anyTag"))}
                        </span>
                        <ChevronsUpDown
                          aria-hidden
                          className="size-4 shrink-0"
                        />
                      </button>
                    }
                    onValueChange={(value) => {
                      setTags(value.slice(0, 50));
                      setPage(1);
                    }}
                  />
                )}
              </FilterField>
              <FilterField
                label={t("groupBy")}
                className="min-w-0 w-full sm:w-40"
              >
                {(id) => (
                  <select
                    id={id}
                    className={control}
                    value={groupBy}
                    onChange={(event) => setGroupBy(event.target.value)}
                  >
                    <option value="tag">{t("byTag")}</option>
                    <option value="none">{t("noGrouping")}</option>
                  </select>
                )}
              </FilterField>
            </div>
            {tagError ? (
              <p role="alert" className="text-small text-danger">
                {t("tagsFailed")}{" "}
                <button
                  type="button"
                  className="text-signal underline"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  {t("retry")}
                </button>
              </p>
            ) : null}
            {tags.length || search ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-label={t("removeTag", { tag })}
                    className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-chip bg-bg-muted px-1.5 py-1 text-meta"
                    onClick={() => {
                      setTags((current) =>
                        current.filter((value) => value !== tag),
                      );
                      setPage(1);
                    }}
                  >
                    <span className="truncate">{tag}</span>
                    <X aria-hidden className="size-3 shrink-0" />
                  </button>
                ))}
                <button
                  type="button"
                  className="text-small text-signal hover:underline"
                  onClick={() => {
                    setTags([]);
                    setSearch("");
                    setPage(1);
                  }}
                >
                  {t("clearFilters")}
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
              <p role="status" className="basis-full text-small text-fg-muted">
                {loading
                  ? t("loading")
                  : t("results", { count: data?.total ?? 0 })}{" "}
                · {t("selected", { count })}
              </p>
              <button
                type="button"
                className={button}
                disabled={loading || !data?.links.length || count >= 500}
                onClick={() => choose(data?.links ?? [], true)}
              >
                {t("selectPage")}
              </button>
              <button
                type="button"
                className={button}
                disabled={loading || !data?.total || count >= 500}
                onClick={() => void chooseAll()}
              >
                {t("selectResults")}
              </button>
              <button
                type="button"
                className={button}
                disabled={!count}
                onClick={() => setChoices({})}
              >
                {t("clearSelection")}
              </button>
              <p className="basis-full text-small text-fg-muted">{t("hint")}</p>
            </div>
            {error === key ? (
              <p role="alert" className="text-small text-danger">
                {t("failed")}{" "}
                <button
                  type="button"
                  className="text-signal underline"
                  onClick={() => {
                    setError("");
                    setRetry((value) => value + 1);
                  }}
                >
                  {t("retry")}
                </button>
              </p>
            ) : null}
            {loading ? (
              <p className="py-4 text-small text-fg-muted">{t("loading")}</p>
            ) : data?.links.length ? (
              [...groups].map(([name, group]) => (
                <section key={name} aria-label={name || undefined}>
                  {name ? (
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-line py-2">
                      <h3
                        className="min-w-0 truncate text-small font-medium"
                        title={name}
                      >
                        {name}
                      </h3>
                      <button
                        type="button"
                        className={button}
                        disabled={count >= 500}
                        onClick={() => choose(group, true)}
                      >
                        {t("selectGroup")}
                      </button>
                    </div>
                  ) : null}
                  <table className="w-full table-fixed text-left text-small">
                    <thead className="border-b border-line text-meta text-fg-muted">
                      <tr>
                        <th className="w-8 py-2">
                          <span className="sr-only">{t("selectPage")}</span>
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          {t("link")}
                        </th>
                        <th
                          scope="col"
                          className="w-40 py-2 font-medium max-sm:hidden"
                        >
                          {t("tags")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {group.map((link) => (
                        <tr key={link.id} className="hover:bg-bg-subtle">
                          <td className="py-2.5 pr-2">
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--color-signal)]"
                              aria-label={t("selectLink", {
                                title: link.title || link.key,
                              })}
                              checked={Boolean(choices[link.id])}
                              disabled={!choices[link.id] && count >= 500}
                              onChange={(event) =>
                                choose([link], event.target.checked)
                              }
                            />
                          </td>
                          <td className="min-w-0 py-2.5 pr-3">
                            <p
                              className="truncate font-medium"
                              title={link.title || link.key}
                            >
                              {link.title || link.key}
                            </p>
                            <p
                              className="truncate text-meta text-fg-muted"
                              title={link.url}
                            >
                              {link.domain}/{link.key} → {link.url}
                            </p>
                          </td>
                          <td className="py-2.5 max-sm:hidden">
                            <div className="flex min-w-0 flex-wrap gap-1">
                              {link.tags.map((tag) => (
                                <span
                                  key={tag.id}
                                  className="max-w-full truncate rounded-chip bg-bg-muted px-1.5 py-0.5 text-meta"
                                  title={tag.name}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))
            ) : !error ? (
              <p className="py-4 text-small text-fg-muted">{t("empty")}</p>
            ) : null}
            {data && (data.pages ?? 1) > 1 ? (
              <nav
                aria-label={t("pages")}
                className="flex flex-wrap items-center justify-between gap-2 text-small"
              >
                <button
                  type="button"
                  className={button}
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  {t("previous")}
                </button>
                <span className="tabular-nums">
                  {page} / {data.pages}
                </span>
                <button
                  type="button"
                  className={button}
                  disabled={page >= (data.pages ?? 1)}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {t("next")}
                </button>
              </nav>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <button
                type="button"
                className={buttonVariants({ variant: "primary", size: "md" })}
                disabled={!count}
                onClick={() => {
                  onChange(Object.values(choices));
                  setOpen(false);
                  onOpenChange(false);
                }}
              >
                {t("use", { count })}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  setOpen(false);
                  onOpenChange(false);
                }}
              >
                {t("cancel")}
              </button>
            </div>
          </fieldset>
        </section>
      ) : null}
    </div>
  );
}
