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
export function LinkExportHistoryFilters() {
  const t = useTranslations("linkExports"),
    params = useSearchParams(),
    state = states.find((value) => value === params.get("state")),
    format = params.get("format");
  return (
    <FilterBar
      applied={[
        ...(state ? [t(`states.${state}`)] : []),
        ...(format === "csv" || format === "json"
          ? [format.toUpperCase()]
          : []),
      ]}
    >
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
          { value: "json", label: "JSON" },
        ]}
      />
    </FilterBar>
  );
}
