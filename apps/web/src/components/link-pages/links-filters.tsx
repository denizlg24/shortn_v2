"use client";

import {
  createdWindows,
  isCreatedWindow,
  isLinkStatus,
  linkSorts,
  linkStatuses,
} from "@shortn/core/links-filters";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FilterBar, FilterSearch, FilterSelect } from "../page/filters";

export function LinksFilters({ tags }: { tags: string[] }) {
  const t = useTranslations("linkPages.list");
  const params = useSearchParams();
  const q = params.get("q");
  const tag = params.get("tag");
  const status = params.get("status");
  const created = params.get("created");
  const applied = [
    q ? `${t("search")}: ${q}` : null,
    tag ? `${t("tag")}: ${tag}` : null,
    isLinkStatus(status) ? t(`statuses.${status}`) : null,
    isCreatedWindow(created) ? t(`createdOptions.${created}`) : null,
  ].filter((item): item is string => Boolean(item));
  return (
    <FilterBar applied={applied}>
      <FilterSearch
        label={t("search")}
        name="q"
        placeholder={t("searchPlaceholder")}
      />
      <FilterSelect
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
      <FilterSelect
        label={t("created")}
        name="created"
        allLabel={t("anyTime")}
        options={createdWindows.map((days) => ({
          value: days,
          label: t(`createdOptions.${days}`),
        }))}
      />
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
