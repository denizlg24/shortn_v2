"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FilterBar, FilterSearch, FilterSelect } from "../page/filters";
import { campaignSorts } from "./campaign-sorts";

export function CampaignsFilters() {
  const t = useTranslations("campaigns.list");
  const q = useSearchParams().get("q");
  return (
    <FilterBar applied={q ? [`${t("search")}: ${q}`] : []}>
      <FilterSearch
        label={t("search")}
        name="q"
        placeholder={t("searchPlaceholder")}
      />
      <FilterSelect
        label={t("sort")}
        name="sort"
        options={campaignSorts.map((sort) => ({
          value: sort,
          label: t(`sorts.${sort}`),
        }))}
      />
    </FilterBar>
  );
}
