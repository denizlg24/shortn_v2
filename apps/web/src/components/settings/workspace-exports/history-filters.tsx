"use client";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FilterBar, FilterSelect } from "@/components/page/filters";
const states = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export function WorkspaceExportHistoryFilters() {
  const t = useTranslations("workspaceExports"),
    params = useSearchParams(),
    state = states.find((value) => value === params.get("state"));
  return (
    <FilterBar applied={state ? [t(`states.${state}`)] : []}>
      <FilterSelect
        name="state"
        label={t("status")}
        allLabel={t("all")}
        options={states.map((value) => ({
          value,
          label: t(`states.${value}`),
        }))}
      />
    </FilterBar>
  );
}
