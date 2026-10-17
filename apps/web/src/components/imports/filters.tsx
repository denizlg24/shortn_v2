"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FilterBar,
  FilterField,
  FilterSearch,
  FilterSelect,
} from "@/components/page/filters";
import { searchImportTagsAction } from "@/server/actions/imports";
import { importErrorKey, importControl } from "@/lib/imports";

function TagSearch({
  workspace,
  id,
  selected,
  initial,
}: {
  workspace: string;
  id: string;
  selected: string;
  initial: string[];
}) {
  const t = useTranslations("imports"),
    list = useId(),
    [search, setSearch] = useState(selected),
    [options, setOptions] = useState(initial);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      void searchImportTagsAction(workspace, id, search)
        .then((result) => {
          if (current && result.data)
            setOptions(result.data.items.map((item) => item.tag));
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [workspace, id, search]);
  return (
    <FilterField label={t("tag")} className="min-w-48 max-w-full flex-1">
      {(input) => (
        <>
          <input
            id={input}
            type="search"
            name="tag"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={64}
            list={list}
            placeholder={t("tagSearch")}
            aria-describedby={`${list}-help`}
            className={importControl}
          />
          <datalist id={list}>
            {options.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          <span
            id={`${list}-help`}
            className="max-w-72 text-meta text-fg-muted"
          >
            {t("tagHelp")}
          </span>
        </>
      )}
    </FilterField>
  );
}

export function ImportFilters({
  workspace,
  id,
  tags = [],
  errors = [],
}: {
  workspace: string;
  id?: string;
  tags?: string[];
  errors?: string[];
}) {
  const t = useTranslations("imports"),
    params = useSearchParams();
  const applied: string[] = [];
  if (id) {
    const search = params.get("q"),
      tag = params.get("tag"),
      status = params.get("status"),
      error = params.get("error");
    if (search) applied.push(`${t("search")}: ${search.slice(0, 200)}`);
    if (tag) applied.push(`${t("tag")}: ${tag.slice(0, 64)}`);
    if (status === "valid" || status === "invalid")
      applied.push(`${t("status")}: ${t(status)}`);
    if (error) applied.push(`${t("error")}: ${t(importErrorKey(error))}`);
    if (params.get("group") === "error")
      applied.push(`${t("group")}: ${t("byError")}`);
  } else {
    const kind = params.get("kind"),
      state = (
        [
          "uploading",
          "inspect_pending",
          "inspecting",
          "mapping",
          "validate_pending",
          "validating",
          "ready",
          "commit_pending",
          "committing",
          "completed",
          "failed",
          "cancelled",
        ] as const
      ).find((value) => value === params.get("state"));
    if (kind === "links" || kind === "qr")
      applied.push(`${t("kind")}: ${t(kind)}`);
    if (state) applied.push(`${t("status")}: ${t(`states.${state}`)}`);
  }
  return (
    <FilterBar applied={applied}>
      {id ? (
        <>
          <FilterSearch label={t("search")} name="q" />
          <TagSearch
            key={params.get("tag") ?? ""}
            workspace={workspace}
            id={id}
            selected={params.get("tag") ?? ""}
            initial={tags}
          />
          <FilterSelect
            name="status"
            label={t("status")}
            allLabel={t("all")}
            options={[
              { value: "valid", label: t("valid") },
              { value: "invalid", label: t("invalid") },
            ]}
          />
          <FilterSelect
            name="error"
            label={t("error")}
            allLabel={t("all")}
            options={errors.map((code) => ({
              value: code,
              label: t(importErrorKey(code)),
            }))}
          />
          <FilterSelect
            name="group"
            label={t("group")}
            options={[
              { value: "none", label: t("ungrouped") },
              { value: "error", label: t("byError") },
            ]}
          />
        </>
      ) : (
        <>
          <FilterSelect
            name="kind"
            label={t("kind")}
            allLabel={t("all")}
            options={[
              { value: "links", label: t("links") },
              { value: "qr", label: t("qr") },
            ]}
          />
          <FilterSelect
            name="state"
            label={t("status")}
            allLabel={t("all")}
            options={(
              [
                "uploading",
                "inspect_pending",
                "inspecting",
                "mapping",
                "validate_pending",
                "validating",
                "ready",
                "commit_pending",
                "committing",
                "completed",
                "failed",
                "cancelled",
              ] as const
            ).map((state) => ({ value: state, label: t(`states.${state}`) }))}
          />
        </>
      )}
    </FilterBar>
  );
}
