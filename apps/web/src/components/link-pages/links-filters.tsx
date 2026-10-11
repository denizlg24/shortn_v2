"use client";

import {
  isLinkStatus,
  linkSorts,
  linkStatuses,
} from "@shortn/core/links-filters";
import { CreatedFilter, createdSummary } from "../page/created-filter";
import { normalizeCreated } from "../page/created-range";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  FilterBar,
  FilterCombobox,
  FilterSearch,
  FilterSelect,
} from "../page/filters";

export function LinksFilters({ tags }: { tags: string[] }) {
  const t = useTranslations("linkPages.list");
  const dateText = useTranslations("page.created");
  const params = useSearchParams();
  const q = params.get("q");
  const tagsSelected = params.getAll("tag");
  const status = params.get("status");
  const applied = [
    q ? `${t("search")}: ${q}` : null,
    ...tagsSelected.map((tag) => `${t("tag")}: ${tag}`),
    isLinkStatus(status) ? t(`statuses.${status}`) : null,
    ...createdSummary(params, {
      preset: (value) => dateText(`presets.${value}`),
      from: (date) => dateText("fromSummary", { date }),
      to: (date) => dateText("toSummary", { date }),
    }),
  ].filter((item): item is string => Boolean(item));
  return (
    <FilterBar
      applied={applied}
      normalize={(next, current) => normalizeCreated(next, current, new Date())}
    >
      <FilterSearch
        label={t("search")}
        name="q"
        placeholder={t("searchPlaceholder")}
      />
      <FilterCombobox
        multiple
        label={t("tag")}
        name="tag"
        allLabel={t("anyTag")}
        options={tags.map((tag) => ({ value: tag, label: tag }))}
      />
      <FilterSelect
        label={t("status")}
        name="status"
        allLabel={t("anyStatus")}
        options={linkStatuses.map((status) => ({
          value: status,
          label: t(`statuses.${status}`),
        }))}
      />
      <CreatedFilter />
      <FilterSelect
        label={t("sort")}
        name="sort"
        options={linkSorts.map((sort) => ({
          value: sort,
          label: t(`sorts.${sort}`),
        }))}
      />
    </FilterBar>
  );
}
