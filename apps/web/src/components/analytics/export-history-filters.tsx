"use client";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FilterBar, FilterSelect } from "../page/filters";
const states = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export function AnalyticsExportHistoryFilters() {
  const t = useTranslations("analyticsExports"),
    params = useSearchParams(),
    state = states.find((value) => value === params.get("state")),
    format = params.get("format"),
    mode = params.get("mode");
  return (
    <FilterBar
      applied={[
        ...(mode === "raw" || mode === "aggregate" ? [t(`modes.${mode}`)] : []),
        ...(state ? [t(`states.${state}`)] : []),
        ...(format === "csv" || format === "ndjson"
          ? [format.toUpperCase()]
          : []),
      ]}
    >
      <FilterSelect
        name="mode"
        label={t("mode")}
        allLabel={t("all")}
        options={[
          { value: "aggregate", label: t("modes.aggregate") },
          { value: "raw", label: t("modes.raw") },
        ]}
      />
      <FilterSelect
        name="state"
        label={t("status")}
        allLabel={t("all")}
        options={states.map((value) => ({
          value,
          label: t(`states.${value}`),
        }))}
      />
      <FilterSelect
        name="format"
        label={t("format")}
        allLabel={t("all")}
        options={[
          { value: "csv", label: "CSV" },
          { value: "ndjson", label: "NDJSON" },
        ]}
      />
    </FilterBar>
  );
}
