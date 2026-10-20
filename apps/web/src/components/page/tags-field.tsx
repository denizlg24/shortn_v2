"use client";

import type { TagColor } from "@shortn/core/tag-options";
import { Combobox } from "@shortn/ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TagDot } from "../tags/tag-chip";
import { FormField } from "./form";

export interface TagOption {
  name: string;
  color: TagColor;
}

/** Search existing tags or create one, posting repeated `tag` fields. */
export function TagsField({
  id,
  allTags,
  selected,
  label,
}: {
  id: string;
  allTags: TagOption[];
  selected: string[];
  label: string;
}) {
  const t = useTranslations("page.tags");
  const [value, setValue] = useState(() => [...new Set(selected)]);
  const [created, setCreated] = useState<string[]>([]);
  const colors = new Map(
    allTags.map((tag) => [tag.name.toLowerCase(), tag.color]),
  );
  const names = [
    ...new Set([...allTags.map((tag) => tag.name), ...selected, ...created]),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <FormField id={id} label={label} hint={t("hint")}>
      {value.map((tag) => (
        <input key={tag} type="hidden" name="tag" value={tag} />
      ))}
      <Combobox
        id={id}
        multiple
        options={names.map((name) => ({
          value: name,
          label: name,
          leading: <TagDot color={colors.get(name.toLowerCase())} />,
        }))}
        value={value}
        onValueChange={(next) => setValue(next.slice(0, 50))}
        placeholder={t("placeholder")}
        searchPlaceholder={t("search")}
        emptyText={t("empty")}
        createLabel={(query) => t("create", { tag: query.slice(0, 48) })}
        onCreate={(query) => {
          const tag = query.trim().slice(0, 48);
          if (!tag || value.length >= 50) return;
          setCreated((items) => [...new Set([...items, tag])]);
          setValue((items) => [...new Set([...items, tag])]);
        }}
        className="h-9 text-body"
      />
      {value.length ? (
        <ul aria-label={t("selected")} className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() =>
                  setValue((items) => items.filter((item) => item !== tag))
                }
                aria-label={t("remove", { tag })}
                className="flex max-w-full items-center gap-1.5 rounded-chip bg-bg-muted px-2 py-1 text-small hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-signal"
              >
                <TagDot color={colors.get(tag.toLowerCase())} />
                <span className="break-all">{tag}</span>
                <X aria-hidden className="size-3 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </FormField>
  );
}
