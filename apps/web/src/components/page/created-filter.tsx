"use client";

import {
  createdWindows,
  isCreatedWindow,
  type CreatedWindow,
} from "@shortn/core/links-filters";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FilterDate, FilterGroup, FilterSelect } from "./filters";
import { utcDay } from "./created-range";

export function createdSummary(
  params: { get(name: string): string | null },
  labels: {
    preset: (value: CreatedWindow) => string;
    from: (value: string) => string;
    to: (value: string) => string;
  },
) {
  const created = params.get("created");
  if (isCreatedWindow(created)) return [labels.preset(created)];
  if (created !== "custom") return [];
  const from = params.get("from");
  const to = params.get("to");
  return [
    from && utcDay(from) ? labels.from(from) : null,
    to && utcDay(to) ? labels.to(to) : null,
  ].filter((value): value is string => Boolean(value));
}

export function CreatedFilter() {
  const t = useTranslations("page.created");
  const params = useSearchParams();
  return (
    <FilterGroup label={t("group")}>
      <FilterSelect
        label={t("label")}
        name="created"
        allLabel={t("any")}
        options={[
          ...createdWindows.map((value) => ({
            value,
            label: t(`presets.${value}`),
          })),
          { value: "custom", label: t("custom") },
        ]}
      />
      {params.get("created") === "custom" ? (
        <>
          <FilterDate label={t("from")} name="from" />
          <FilterDate label={t("to")} name="to" />
        </>
      ) : null}
    </FilterGroup>
  );
}
