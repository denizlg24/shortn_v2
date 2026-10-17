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
import { RemoteLinkTags } from "./remote-tags";
import {
  FilterBar,
  FilterCombobox,
  FilterSearch,
  FilterSelect,
} from "../page/filters";

export function LinksFilters({
  tags,
  trash = false,
  archived = false,
  workspace,
  preserve,
}: {
  tags: string[];
  trash?: boolean;
  archived?: boolean;
  workspace?: string;
  preserve?: Record<string, string>;
}) {
  const t = useTranslations("linkPages.list");
  const trashText = useTranslations("linkPages.trash");
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
      clearParams={
        trash || archived || preserve
          ? {
              ...preserve,
              ...(trash ? { trash: "1" } : archived ? { archived: "1" } : {}),
            }
          : undefined
      }
      normalize={(next, current) => normalizeCreated(next, current, new Date())}
    >
      {Object.entries(preserve ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {trash ? <input type="hidden" name="trash" value="1" /> : null}
      {archived ? <input type="hidden" name="archived" value="1" /> : null}
      <FilterSearch
        label={t("search")}
        name="q"
        placeholder={t("searchPlaceholder")}
      />
      {workspace ? (
        <RemoteLinkTags workspace={workspace} initial={tags} />
      ) : (
        <FilterCombobox
          multiple
          label={t("tag")}
          name="tag"
          allLabel={t("anyTag")}
          options={tags.map((tag) => ({ value: tag, label: tag }))}
        />
      )}
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
      {trash || archived ? (
        <FilterSelect
          label={trashText("group")}
          name="group"
          options={[
            { value: "", label: trashText("ungrouped") },
            { value: "tag", label: trashText("byTag") },
          ]}
        />
      ) : null}
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
