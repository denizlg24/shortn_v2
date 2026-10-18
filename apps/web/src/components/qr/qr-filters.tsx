"use client";

import { CreatedFilter, createdSummary } from "../page/created-filter";
import { normalizeCreated } from "../page/created-range";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FilterBar, FilterCombobox, FilterSearch } from "../page/filters";

export function QrFilters({
  tags,
  preserve = {},
}: {
  tags: string[];
  preserve?: Record<string, string>;
}) {
  const t = useTranslations("qr.list");
  const dateText = useTranslations("page.created");
  const params = useSearchParams();
  const q = params.get("q");
  const tagsSelected = params.getAll("tag");
  const applied = [
    q ? `${t("search")}: ${q}` : null,
    ...tagsSelected.map((tag) => `${t("tag")}: ${tag}`),
    ...createdSummary(params, {
      preset: (value) => dateText(`presets.${value}`),
      from: (date) => dateText("fromSummary", { date }),
      to: (date) => dateText("toSummary", { date }),
    }),
  ].filter((item): item is string => Boolean(item));
  return (
    <FilterBar
      applied={applied}
      clearParams={{
        ...preserve,
        ...(params.get("view") === "list" ? { view: "list" } : {}),
      }}
      normalize={(next, current) => normalizeCreated(next, current, new Date())}
    >
      {Object.entries(preserve).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {params.get("view") === "list" ? (
        <input type="hidden" name="view" value="list" />
      ) : null}
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
        options={tags.map((name) => ({ value: name, label: name }))}
      />
      <CreatedFilter />
    </FilterBar>
  );
}
