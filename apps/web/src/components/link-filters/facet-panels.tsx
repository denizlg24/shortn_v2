"use client";

import {
  createdWindows,
  linkStatuses,
  type CreatedWindow,
} from "@shortn/core/links-filters";
import type { TagColor } from "@shortn/core/tag-options";
import {
  Button,
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@shortn/ui";
import { Check, ChevronLeft, LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  campaignFacetAction,
  tagFacetAction,
  type CampaignFacetPage,
  type TagFacetPage,
} from "@/server/actions/link-filters";
import { TagDot } from "../tags/tag-chip";
import type { Facet, LinkFilterState } from "./state";

export interface FacetOptions {
  workspace: string;
  value: LinkFilterState;
  onChange: (next: LinkFilterState) => void;
  domains: string[];
  /** The view tag counts describe, as a query string; null hides counts. */
  countView: string | null;
  manageTagsHref: string | null;
  campaignLabels: Record<string, string>;
  rememberCampaign: (id: string, title: string) => void;
}

const dayMs = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-chip border border-line-strong",
        checked && "border-signal bg-signal text-signal-fg",
      )}
    >
      <Check
        className={cn("size-3 text-current!", !checked && "opacity-0")}
        strokeWidth={3}
      />
    </span>
  );
}

function Mark({ checked }: { checked: boolean }) {
  return (
    <Check
      aria-hidden
      className={cn("size-4 text-fg!", !checked && "opacity-0")}
    />
  );
}

function Count({ value }: { value: number | null | undefined }) {
  const format = useFormatter();
  return value === null || value === undefined ? null : (
    <span className="font-mono tabular-nums">{format.number(value)}</span>
  );
}

function Pending({ active }: { active: boolean }) {
  return active ? (
    <LoaderCircle
      aria-hidden
      className="size-3.5 shrink-0 animate-spin text-fg-subtle"
    />
  ) : null;
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useTranslations("linkFilters");
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("back")}
        onClick={onBack}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <span className="truncate text-small font-medium">{title}</span>
    </div>
  );
}

function Status({ children, alert }: { children: ReactNode; alert?: boolean }) {
  return (
    <p
      role={alert ? "alert" : "status"}
      className="px-3 py-5 text-center text-small text-fg-muted"
    >
      {children}
    </p>
  );
}

export function FacetPanel({
  facet,
  options,
  onBack,
  onDone,
}: {
  facet: Facet;
  options: FacetOptions;
  onBack?: (() => void) | undefined;
  onDone: () => void;
}) {
  const t = useTranslations("linkFilters");
  return (
    <div className="flex max-h-[min(30rem,70vh)] flex-col">
      {onBack ? (
        <PanelHeader title={t(`facets.${facet}`)} onBack={onBack} />
      ) : null}
      {facet === "tags" ? (
        <TagFacet options={options} />
      ) : facet === "status" ? (
        <StatusFacet options={options} onDone={onDone} />
      ) : facet === "domain" ? (
        <DomainFacet options={options} onDone={onDone} />
      ) : facet === "campaign" ? (
        <CampaignFacet options={options} onDone={onDone} />
      ) : (
        <CreatedFacet options={options} onDone={onDone} />
      )}
    </div>
  );
}

type TagRow = { name: string; color: TagColor | null; links: number | null };

function TagFacet({ options }: { options: FacetOptions }) {
  const t = useTranslations("linkFilters");
  const { workspace, value, onChange, countView, manageTagsHref } = options;
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([query.trim(), countView, retry]);
  const [data, setData] = useState<{
    key: string;
    pages: TagFacetPage[];
    failed: boolean;
    more: boolean;
  }>({ key: "", pages: [], failed: false, more: false });
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () => {
        tagFacetAction(workspace, {
          search: query.trim(),
          page: 1,
          view: countView,
        })
          .then((page) => {
            if (live)
              setData({
                key,
                pages: page ? [page] : [],
                failed: !page,
                more: false,
              });
          })
          .catch(() => {
            if (live) setData({ key, pages: [], failed: true, more: false });
          });
      },
      query ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [workspace, query, countView, key]);
  // Keep the previous rows on screen while a new search or count loads.
  const current = data.key ? data : null;
  const stale = data.key !== key;
  const last = current?.pages.at(-1);
  const known = new Map<string, TagRow>();
  for (const page of current?.pages ?? [])
    for (const item of page.items) known.set(item.name, item);
  const selected = new Set(value.tags);
  const rows: TagRow[] = query.trim()
    ? [...known.values()]
    : [
        ...value.tags.map(
          (name) => known.get(name) ?? { name, color: null, links: null },
        ),
        ...[...known.values()].filter((row) => !selected.has(row.name)),
      ];
  const untagged = current?.pages[0]?.untagged ?? null;
  const toggle = (name: string) => {
    const tags = selected.has(name)
      ? value.tags.filter((tag) => tag !== name)
      : [...value.tags, name].slice(0, 50);
    onChange({
      ...value,
      tags,
      tagMode: tags.length > 1 ? value.tagMode : "any",
    });
  };
  const loadMore = () => {
    if (!last || data.more || stale) return;
    setData((state) => ({ ...state, more: true }));
    tagFacetAction(workspace, {
      search: query.trim(),
      page: last.page + 1,
      view: countView,
    })
      .then((page) =>
        setData((state) =>
          state.key === key
            ? {
                ...state,
                pages: page ? [...state.pages, page] : state.pages,
                failed: !page,
                more: false,
              }
            : state,
        ),
      )
      .catch(() =>
        setData((state) =>
          state.key === key ? { ...state, failed: true, more: false } : state,
        ),
      );
  };
  return (
    <Command shouldFilter={false} loop className="min-h-0">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("tagsFacet.search")}
        aria-label={t("tagsFacet.search")}
        frameClassName="h-10 px-3"
        className="text-small"
        autoFocus
        trailing={<Pending active={Boolean(current) && stale} />}
      />
      <CommandList className="max-h-72 p-1">
        {!current ? (
          <Status>{t("loading")}</Status>
        ) : current.failed && !rows.length ? (
          <Status alert>
            {t("tagsFacet.failed")}{" "}
            <button
              type="button"
              className="cursor-pointer text-signal hover:underline"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t("retry")}
            </button>
          </Status>
        ) : !rows.length ? (
          <CommandEmpty className="py-5">{t("tagsFacet.empty")}</CommandEmpty>
        ) : null}
        {rows.length ? (
          <CommandGroup>
            {rows.map((row) => (
              <CommandItem
                key={row.name}
                value={`tag:${row.name}`}
                onSelect={() => toggle(row.name)}
                className="h-8"
                icon={
                  <span className="flex items-center gap-2">
                    <Checkbox checked={selected.has(row.name)} />
                    <TagDot color={row.color} />
                  </span>
                }
                meta={<Count value={row.links} />}
              >
                {row.name}
              </CommandItem>
            ))}
            {last?.more ? (
              <CommandItem
                value="__more"
                onSelect={loadMore}
                className="h-8 text-fg-muted"
                icon={
                  data.more ? (
                    <LoaderCircle aria-hidden className="animate-spin" />
                  ) : (
                    <span aria-hidden className="size-4" />
                  )
                }
              >
                {data.more ? t("loading") : t("tagsFacet.more")}
              </CommandItem>
            ) : null}
          </CommandGroup>
        ) : null}
        {current && !query.trim() ? (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__untagged"
                disabled={value.tagMode === "all"}
                onSelect={() =>
                  onChange({ ...value, untagged: !value.untagged })
                }
                className="h-8"
                icon={
                  <span className="flex items-center gap-2">
                    <Checkbox checked={value.untagged} />
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full border border-fg-subtle"
                    />
                  </span>
                }
                meta={<Count value={untagged} />}
              >
                {t("tagsFacet.untagged")}
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
      {value.tags.length > 1 || manageTagsHref ? (
        <div className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-t border-line px-2 py-1.5">
          {value.tags.length > 1 ? (
            <MatchToggle
              value={value.tagMode}
              onChange={(tagMode) =>
                onChange({
                  ...value,
                  tagMode,
                  untagged: tagMode === "all" ? false : value.untagged,
                })
              }
            />
          ) : (
            <span />
          )}
          {manageTagsHref ? (
            <Link
              href={manageTagsHref}
              className="rounded-control px-1.5 py-1 text-small text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              {t("tagsFacet.manage")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </Command>
  );
}

function MatchToggle({
  value,
  onChange,
}: {
  value: LinkFilterState["tagMode"];
  onChange: (value: LinkFilterState["tagMode"]) => void;
}) {
  const t = useTranslations("linkFilters.tagsFacet");
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <span id={id} className="text-meta text-fg-muted">
        {t("match")}
      </span>
      <div
        role="group"
        aria-labelledby={id}
        className="flex rounded-control border border-line-strong p-0.5"
      >
        {(["any", "all"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={value === mode}
            title={t(`${mode}Hint`)}
            onClick={() => onChange(mode)}
            className={cn(
              "h-6 cursor-pointer rounded-chip px-2 text-meta font-medium",
              value === mode
                ? "bg-bg-muted text-fg"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {t(mode)}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusFacet({
  options,
  onDone,
}: {
  options: FacetOptions;
  onDone: () => void;
}) {
  const list = useTranslations("linkPages.list");
  const { value, onChange } = options;
  return (
    <Command loop>
      <CommandList className="p-1">
        <CommandGroup>
          {linkStatuses.map((status) => (
            <CommandItem
              key={status}
              value={status}
              className="h-8"
              icon={<Mark checked={value.status === status} />}
              onSelect={() => {
                onChange({
                  ...value,
                  status: value.status === status ? null : status,
                });
                onDone();
              }}
            >
              {list(`statuses.${status}`)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function DomainFacet({
  options,
  onDone,
}: {
  options: FacetOptions;
  onDone: () => void;
}) {
  const t = useTranslations("linkFilters");
  const { value, onChange, domains } = options;
  return (
    <Command loop className="min-h-0">
      {domains.length > 6 ? (
        <CommandInput
          placeholder={t("domainFacet.search")}
          aria-label={t("domainFacet.search")}
          frameClassName="h-10 px-3"
          className="text-small"
          autoFocus
        />
      ) : null}
      <CommandList className="max-h-72 p-1">
        <CommandEmpty className="py-5">{t("domainFacet.empty")}</CommandEmpty>
        <CommandGroup>
          {domains.map((domain, index) => (
            <CommandItem
              key={domain}
              value={domain}
              className="h-8"
              icon={<Mark checked={value.domain === domain} />}
              {...(index === 0 ? { meta: t("domainFacet.default") } : {})}
              onSelect={() => {
                onChange({
                  ...value,
                  domain: value.domain === domain ? null : domain,
                });
                onDone();
              }}
            >
              {domain}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function CampaignFacet({
  options,
  onDone,
}: {
  options: FacetOptions;
  onDone: () => void;
}) {
  const t = useTranslations("linkFilters");
  const { workspace, value, onChange, rememberCampaign } = options;
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([query.trim(), retry]);
  const [data, setData] = useState<{
    key: string;
    pages: CampaignFacetPage[];
    failed: boolean;
    more: boolean;
  }>({ key: "", pages: [], failed: false, more: false });
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () => {
        campaignFacetAction(workspace, { search: query.trim(), cursor: null })
          .then((page) => {
            if (live)
              setData({
                key,
                pages: page ? [page] : [],
                failed: !page,
                more: false,
              });
          })
          .catch(() => {
            if (live) setData({ key, pages: [], failed: true, more: false });
          });
      },
      query ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [workspace, query, key]);
  const current = data.key ? data : null;
  const stale = data.key !== key;
  const items = current?.pages.flatMap((page) => page.items) ?? [];
  const cursor = current?.pages.at(-1)?.nextCursor ?? null;
  const loadMore = () => {
    if (!cursor || data.more || stale) return;
    setData((state) => ({ ...state, more: true }));
    campaignFacetAction(workspace, { search: query.trim(), cursor })
      .then((page) =>
        setData((state) =>
          state.key === key
            ? {
                ...state,
                pages: page ? [...state.pages, page] : state.pages,
                failed: !page,
                more: false,
              }
            : state,
        ),
      )
      .catch(() =>
        setData((state) =>
          state.key === key ? { ...state, failed: true, more: false } : state,
        ),
      );
  };
  return (
    <Command shouldFilter={false} loop className="min-h-0">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("campaignFacet.search")}
        aria-label={t("campaignFacet.search")}
        frameClassName="h-10 px-3"
        className="text-small"
        autoFocus
        trailing={<Pending active={Boolean(current) && stale} />}
      />
      <CommandList className="max-h-72 p-1">
        {!current ? (
          <Status>{t("loading")}</Status>
        ) : current.failed && !items.length ? (
          <Status alert>
            {t("campaignFacet.failed")}{" "}
            <button
              type="button"
              className="cursor-pointer text-signal hover:underline"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t("retry")}
            </button>
          </Status>
        ) : !items.length ? (
          <CommandEmpty className="py-5">
            {t("campaignFacet.empty")}
          </CommandEmpty>
        ) : (
          <CommandGroup>
            {items.map((campaign) => (
              <CommandItem
                key={campaign.id}
                value={`campaign:${campaign.id}`}
                className="h-8"
                icon={<Mark checked={value.campaign === campaign.id} />}
                meta={<Count value={campaign.links} />}
                onSelect={() => {
                  rememberCampaign(campaign.id, campaign.title);
                  onChange({
                    ...value,
                    campaign:
                      value.campaign === campaign.id ? null : campaign.id,
                  });
                  onDone();
                }}
              >
                {campaign.title}
              </CommandItem>
            ))}
            {cursor ? (
              <CommandItem
                value="__more"
                onSelect={loadMore}
                className="h-8 text-fg-muted"
                icon={
                  data.more ? (
                    <LoaderCircle aria-hidden className="animate-spin" />
                  ) : (
                    <span aria-hidden className="size-4" />
                  )
                }
              >
                {data.more ? t("loading") : t("campaignFacet.more")}
              </CommandItem>
            ) : null}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

function CreatedFacet({
  options,
  onDone,
}: {
  options: FacetOptions;
  onDone: () => void;
}) {
  const t = useTranslations("linkFilters.createdFacet");
  const presets = useTranslations("page.created.presets");
  const { value, onChange } = options;
  const created = value.created;
  const [custom, setCustom] = useState(created?.kind === "custom");
  const [range, setRange] = useState(() => {
    const now = new Date();
    return created?.kind === "custom"
      ? { from: created.from ?? "", to: created.to ?? "" }
      : { from: isoDay(new Date(now.getTime() - 29 * dayMs)), to: isoDay(now) };
  });
  const fromId = useId(),
    toId = useId();
  const choose = (window: CreatedWindow) => {
    onChange({
      ...value,
      created:
        created?.kind === "window" && created.window === window
          ? null
          : { kind: "window", window },
    });
    onDone();
  };
  return (
    <div className="flex min-h-0 flex-col">
      <Command loop>
        <CommandList className="p-1">
          <CommandGroup>
            {createdWindows.map((window) => (
              <CommandItem
                key={window}
                value={`window:${window}`}
                className="h-8"
                icon={
                  <Mark
                    checked={
                      created?.kind === "window" && created.window === window
                    }
                  />
                }
                onSelect={() => choose(window)}
              >
                {presets(window)}
              </CommandItem>
            ))}
            <CommandItem
              value="custom"
              className="h-8"
              icon={<Mark checked={created?.kind === "custom"} />}
              onSelect={() => setCustom(true)}
            >
              {t("custom")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
      {custom ? (
        <form
          className="grid gap-2 border-t border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const [from, to] =
              range.from && range.to && range.from > range.to
                ? [range.to, range.from]
                : [range.from, range.to];
            onChange({
              ...value,
              created: { kind: "custom", from: from || null, to: to || null },
            });
            onDone();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                [fromId, "from"],
                [toId, "to"],
              ] as const
            ).map(([id, key]) => (
              <div key={key} className="grid min-w-0 gap-1">
                <label htmlFor={id} className="text-meta text-fg-muted">
                  {t(key)}
                </label>
                <input
                  id={id}
                  type="date"
                  value={range[key]}
                  onChange={(event) =>
                    setRange((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="h-8 min-w-0 rounded-control border border-line-strong bg-field px-2 text-small text-fg focus-visible:border-signal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
                />
              </div>
            ))}
          </div>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!range.from && !range.to}
          >
            {t("apply")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
