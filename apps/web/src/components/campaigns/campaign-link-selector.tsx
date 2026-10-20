"use client";

import type { LinkView } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  searchLinkLibraryAction,
  selectLinkLibraryAction,
} from "@/server/actions/link-library";
import { linkFacetOptionsAction } from "@/server/actions/link-filters";
import { LinkToolbar } from "../link-filters/toolbar";
import {
  emptyLinkFilters,
  facets as allFacets,
  linkFiltersSearch,
  type LinkFilterState,
} from "../link-filters/state";
import { TagChipList } from "../tags/tag-chip";

const button = buttonVariants({ variant: "secondary", size: "md" });
const limit = 500;
const initialFilters: LinkFilterState = { ...emptyLinkFilters, group: "tag" };

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
  const tags = useTranslations("tags");
  const [open, setOpen] = useState(false),
    [filters, setFilters] = useState(initialFilters),
    [page, setPage] = useState(1);
  const [setup, setSetup] = useState<{
    domains: string[];
    campaigns: boolean;
  } | null>(null);
  const [choices, setChoices] = useState<Record<string, LinkView>>({});
  const [result, setResult] = useState<{
    key: string;
    data: Awaited<ReturnType<typeof searchLinkLibraryAction>>;
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  const query = linkFiltersSearch(filters).toString();
  const key = JSON.stringify([query, page, retry]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    linkFacetOptionsAction(workspace)
      .then((value) => {
        if (live) setSetup(value);
      })
      .catch(() => {
        if (live) setSetup({ domains: [], campaigns: false });
      });
    return () => {
      live = false;
    };
  }, [open, workspace]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    searchLinkLibraryAction(workspace, { query, page })
      .then((data) => {
        if (live) {
          setResult({ key, data });
          setError("");
        }
      })
      .catch(() => {
        if (live) setError(key);
      });
    return () => {
      live = false;
    };
  }, [open, workspace, query, page, key]);
  const data = result?.key === key ? result.data : null;
  const shown = data ?? result?.data ?? null;
  const loading = !data && error !== key;
  const count = Object.keys(choices).length;
  function choose(links: LinkView[], checked: boolean) {
    setChoices((current) => {
      const next = { ...current };
      for (const link of links) {
        if (!checked) delete next[link.id];
        else if (Object.keys(next).length < limit) next[link.id] = link;
      }
      return next;
    });
  }
  async function chooseAll() {
    setBusy(true);
    try {
      choose(
        await selectLinkLibraryAction(workspace, {
          query,
          excluded: Object.keys(choices),
          capacity: limit - count,
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
  for (const link of shown?.links ?? []) {
    const name =
      filters.group === "tag"
        ? (link.tags.find((tag) => filters.tags.includes(tag.name))?.name ??
          link.tags[0]?.name ??
          t("untagged"))
        : "";
    groups.set(name, [...(groups.get(name) ?? []), link]);
  }
  const facets = allFacets.filter(
    (facet) =>
      (facet !== "domain" ||
        (setup?.domains.length ?? 0) > 1 ||
        filters.domain) &&
      (facet !== "campaign" || setup?.campaigns || filters.campaign),
  );
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
            setFilters(initialFilters);
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
          <fieldset disabled={disabled || busy} className="grid min-w-0 gap-3">
            <LinkToolbar
              workspace={workspace}
              value={filters}
              onChange={(next) => {
                setFilters(next);
                setPage(1);
              }}
              facets={facets}
              domains={setup?.domains ?? []}
              countView={linkFiltersSearch({
                ...filters,
                tags: [],
                untagged: false,
                tagMode: "any",
                sort: "newest",
                group: null,
              }).toString()}
              pending={loading}
              grouping
              className="mb-0"
            />
            <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
              <p role="status" className="basis-full text-small text-fg-muted">
                {loading && !shown
                  ? t("loading")
                  : t("results", { count: shown?.total ?? 0 })}{" "}
                · {t("selected", { count })}
              </p>
              <button
                type="button"
                className={button}
                disabled={loading || !data?.links.length || count >= limit}
                onClick={() => choose(data?.links ?? [], true)}
              >
                {t("selectPage")}
              </button>
              <button
                type="button"
                className={button}
                disabled={loading || !data?.total || count >= limit}
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
              <p className="basis-full text-meta text-fg-muted">{t("hint")}</p>
            </div>
            {error === key ? (
              <p role="alert" className="text-small text-danger">
                {t("failed")}{" "}
                <button
                  type="button"
                  className="cursor-pointer text-signal underline"
                  onClick={() => {
                    setError("");
                    setRetry((value) => value + 1);
                  }}
                >
                  {t("retry")}
                </button>
              </p>
            ) : null}
            {!shown ? (
              loading ? (
                <p className="py-4 text-small text-fg-muted">{t("loading")}</p>
              ) : null
            ) : shown.links.length ? (
              <div
                className={loading ? "opacity-60 transition-opacity" : ""}
                aria-busy={loading || undefined}
              >
                {[...groups].map(([name, group]) => (
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
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                          disabled={count >= limit}
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
                            className="w-44 py-2 font-medium max-sm:hidden"
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
                                disabled={!choices[link.id] && count >= limit}
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
                              <TagChipList
                                tags={link.tags}
                                colors={shown.colors}
                                max={2}
                                moreLabel={(more) =>
                                  tags("more", { count: more })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            ) : (
              <p className="py-4 text-small text-fg-muted">{t("empty")}</p>
            )}
            {shown && (shown.pages ?? 1) > 1 ? (
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
                  {page} / {shown.pages}
                </span>
                <button
                  type="button"
                  className={button}
                  disabled={page >= (shown.pages ?? 1)}
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
