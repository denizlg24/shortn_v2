"use client";

import { linkSorts } from "@shortn/core/links-filters";
import {
  Button,
  cn,
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@shortn/ui";
import {
  ArrowDownUp,
  CalendarDays,
  CircleDot,
  Globe,
  ListFilter,
  Megaphone,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { FacetPanel, type FacetOptions } from "./facet-panels";
import { SearchField } from "./search-field";
import {
  clearFacet,
  clearLinkFilters,
  isFacetActive,
  type Facet,
  type LinkFilterState,
} from "./state";

const facetIcons: Record<Facet, LucideIcon> = {
  tags: Tag,
  status: CircleDot,
  domain: Globe,
  campaign: Megaphone,
  created: CalendarDays,
};

// Popovers stay inside a 390px viewport with an 8px gutter on each side.
const panelWidth = "w-[min(20rem,calc(100vw-1rem))] p-0";

export interface LinkToolbarProps {
  workspace: string;
  value: LinkFilterState;
  onChange: (next: LinkFilterState) => void;
  facets: readonly Facet[];
  domains: string[];
  /** Title of the active campaign when the server already knows it. */
  campaignLabel?: string | null | undefined;
  /** View the tag counts describe, as a query string; null hides counts. */
  countView: string | null;
  manageTagsHref?: string | null | undefined;
  /** Matching links; omitted where the page states its own count. */
  total?: number | null | undefined;
  pending?: boolean | undefined;
  sorts?: boolean | undefined;
  grouping?: boolean | undefined;
  /** URL mode renders Clear all as a link so it works before hydration. */
  clearHref?: string | undefined;
  className?: string | undefined;
}

export function LinkToolbar({
  workspace,
  value,
  onChange,
  facets,
  domains,
  campaignLabel,
  countView,
  manageTagsHref = null,
  total,
  pending = false,
  sorts = true,
  grouping = false,
  clearHref,
  className,
}: LinkToolbarProps) {
  const t = useTranslations("linkFilters");
  const [campaignLabels, setCampaignLabels] = useState<Record<string, string>>(
    {},
  );
  const options: FacetOptions = {
    workspace,
    value,
    onChange,
    domains,
    countView,
    manageTagsHref,
    campaignLabels:
      value.campaign && campaignLabel
        ? { ...campaignLabels, [value.campaign]: campaignLabel }
        : campaignLabels,
    rememberCampaign: (id, title) =>
      setCampaignLabels((labels) => ({ ...labels, [id]: title })),
  };
  const active = facets.filter((facet) => isFacetActive(value, facet));
  const count =
    total === null || total === undefined ? null : (
      <span
        aria-live="polite"
        className={cn(
          "text-small whitespace-nowrap text-fg-muted tabular-nums transition-opacity duration-(--motion-fast)",
          pending && "opacity-50",
        )}
      >
        {t("results", { count: total })}
      </span>
    );
  const clearable = active.length > 0 || Boolean(value.search.trim());
  return (
    <div
      role="search"
      aria-label={t("label")}
      aria-busy={pending || undefined}
      className={cn("mb-4 flex min-w-0 flex-col gap-2", className)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <SearchField
          value={value.search}
          onCommit={(search) => onChange({ ...value, search })}
          label={t("search")}
          placeholder={t("searchPlaceholder")}
          clearLabel={t("clearSearch")}
          className="w-full sm:max-w-80"
        />
        <FilterMenu facets={facets} options={options} />
        {sorts || grouping ? (
          <DisplayMenu
            value={value}
            onChange={onChange}
            sorts={sorts}
            grouping={grouping}
          />
        ) : null}
        {count ? <div className="ml-auto max-sm:hidden">{count}</div> : null}
      </div>
      {active.length || clearable || count ? (
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-1.5",
            !active.length && !clearable && "sm:hidden",
          )}
        >
          {active.map((facet) => (
            <FilterToken key={facet} facet={facet} options={options} />
          ))}
          {clearable ? (
            clearHref ? (
              <Link
                href={clearHref}
                scroll={false}
                className="rounded-control px-1.5 py-1 text-small text-fg-muted hover:bg-bg-muted hover:text-fg"
              >
                {t("clear")}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onChange(clearLinkFilters(value))}
                className="cursor-pointer rounded-control px-1.5 py-1 text-small text-fg-muted hover:bg-bg-muted hover:text-fg"
              >
                {t("clear")}
              </button>
            )
          ) : null}
          {count ? <div className="ml-auto sm:hidden">{count}</div> : null}
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {pending ? t("loading") : ""}
      </span>
    </div>
  );
}

function FilterMenu({
  facets,
  options,
}: {
  facets: readonly Facet[];
  options: FacetOptions;
}) {
  const t = useTranslations("linkFilters");
  const [open, setOpen] = useState(false);
  const [facet, setFacet] = useState<Facet | null>(null);
  const active = facets.filter((item) => isFacetActive(options.value, item));
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFacet(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="md"
          aria-label={
            active.length
              ? t("filterActive", { count: active.length })
              : t("filter")
          }
          className="max-sm:w-8 max-sm:px-0"
        >
          <ListFilter aria-hidden />
          <span className="max-sm:hidden">{t("filter")}</span>
          {active.length ? (
            <span className="grid h-4 min-w-4 place-items-center rounded-chip bg-fg/8 px-1 font-mono text-meta text-fg tabular-nums max-sm:absolute max-sm:-top-1.5 max-sm:-right-1.5 max-sm:bg-primary max-sm:text-primary-fg">
              {active.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={panelWidth}>
        {facet ? (
          <FacetPanel
            facet={facet}
            options={options}
            onBack={() => setFacet(null)}
            onDone={() => {
              setOpen(false);
              setFacet(null);
            }}
          />
        ) : (
          <FacetList facets={facets} options={options} onPick={setFacet} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function FacetList({
  facets,
  options,
  onPick,
}: {
  facets: readonly Facet[];
  options: FacetOptions;
  onPick: (facet: Facet) => void;
}) {
  const t = useTranslations("linkFilters");
  const summary = useFacetSummary(options);
  return (
    <Command loop>
      <CommandInput
        placeholder={t("filterBy")}
        aria-label={t("filterBy")}
        frameClassName="h-10 px-3"
        className="text-small"
        autoFocus
      />
      <CommandList className="p-1">
        <CommandGroup>
          {facets.map((facet) => {
            const Icon = facetIcons[facet];
            const active = isFacetActive(options.value, facet);
            return (
              <CommandItem
                key={facet}
                value={t(`facets.${facet}`)}
                className="h-8"
                icon={<Icon aria-hidden />}
                {...(active ? { meta: summary(facet).values } : {})}
                onSelect={() => onPick(facet)}
              >
                {t(`facets.${facet}`)}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

/** Human-readable operator and values for an active facet. */
function useFacetSummary(options: FacetOptions) {
  const t = useTranslations("linkFilters");
  const list = useTranslations("linkPages.list");
  const presets = useTranslations("page.created.presets");
  const format = useFormatter();
  const { value } = options;
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return (facet: Facet): { operator: string; values: string } => {
    switch (facet) {
      case "tags": {
        const names = [
          ...value.tags,
          ...(value.untagged ? [t("tagsFacet.untagged")] : []),
        ];
        return {
          operator:
            names.length < 2
              ? t("operators.is")
              : value.tagMode === "all"
                ? t("operators.isAllOf")
                : t("operators.isAnyOf"),
          values:
            names.length <= 2
              ? names.join(", ")
              : t("andMore", { first: names[0]!, count: names.length - 1 }),
        };
      }
      case "status":
        return {
          operator: t("operators.is"),
          values: value.status ? list(`statuses.${value.status}`) : "",
        };
      case "domain":
        return { operator: t("operators.is"), values: value.domain ?? "" };
      case "campaign":
        return {
          operator: t("operators.is"),
          values: value.campaign
            ? (options.campaignLabels[value.campaign] ??
              t("campaignFacet.unknown"))
            : "",
        };
      case "created": {
        const created = value.created;
        return {
          operator: "·",
          values: !created
            ? ""
            : created.kind === "window"
              ? presets(created.window)
              : created.from && created.to
                ? t("createdFacet.range", {
                    from: day(created.from),
                    to: day(created.to),
                  })
                : created.from
                  ? t("createdFacet.since", { from: day(created.from) })
                  : created.to
                    ? t("createdFacet.until", { to: day(created.to) })
                    : t("createdFacet.custom"),
        };
      }
    }
  };
}

function FilterToken({
  facet,
  options,
}: {
  facet: Facet;
  options: FacetOptions;
}) {
  const t = useTranslations("linkFilters");
  const [open, setOpen] = useState(false);
  const { operator, values } = useFacetSummary(options)(facet);
  const label = `${t(`facets.${facet}`)} ${operator} ${values}`;
  return (
    <span className="inline-flex h-7 max-w-full min-w-0 items-stretch rounded-control border border-line-strong bg-field text-small">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("editFilter", { filter: label })}
            className="flex min-w-0 cursor-pointer items-center gap-1 rounded-l-[5px] pr-1.5 pl-2 outline-offset-0 hover:bg-bg-subtle aria-expanded:bg-bg-subtle"
          >
            <span className="shrink-0 text-fg-muted">
              {t(`facets.${facet}`)}
            </span>
            <span className="shrink-0 text-fg-subtle">{operator}</span>
            <span className="max-w-[min(14rem,50vw)] truncate font-medium text-fg">
              {values}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className={panelWidth}>
          <FacetPanel
            facet={facet}
            options={options}
            onDone={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label={t("remove", { filter: label })}
        onClick={() => options.onChange(clearFacet(options.value, facet))}
        className="grid w-7 shrink-0 cursor-pointer place-items-center rounded-r-[5px] border-l border-line text-fg-subtle outline-offset-0 hover:bg-bg-subtle hover:text-fg"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}

function DisplayMenu({
  value,
  onChange,
  sorts,
  grouping,
}: {
  value: LinkFilterState;
  onChange: (next: LinkFilterState) => void;
  sorts: boolean;
  grouping: boolean;
}) {
  const t = useTranslations("linkFilters");
  const list = useTranslations("linkPages.list");
  const current: ReactNode = sorts
    ? list(`sorts.${value.sort}`)
    : t(value.group ? "groups.tag" : "groups.none");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="md"
          aria-label={t("displayLabel", {
            sort: list(`sorts.${value.sort}`),
          })}
          className="max-sm:w-8 max-sm:px-0"
        >
          <ArrowDownUp aria-hidden />
          <span className="max-sm:hidden">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {sorts ? (
          <>
            <DropdownMenuLabel>{t("sort")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={value.sort}
              onValueChange={(sort) => {
                const next = linkSorts.find((item) => item === sort);
                if (next) onChange({ ...value, sort: next });
              }}
            >
              {linkSorts.map((sort) => (
                <DropdownMenuRadioItem key={sort} value={sort}>
                  {list(`sorts.${sort}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
        {sorts && grouping ? <DropdownMenuSeparator /> : null}
        {grouping ? (
          <>
            <DropdownMenuLabel>{t("group")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={value.group ?? "none"}
              onValueChange={(group) =>
                onChange({ ...value, group: group === "tag" ? "tag" : null })
              }
            >
              <DropdownMenuRadioItem value="none">
                {t("groups.none")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="tag">
                {t("groups.tag")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
