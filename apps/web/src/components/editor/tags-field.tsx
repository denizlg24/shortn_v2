"use client";

import { Combobox } from "@shortn/ui";
import { useTranslations } from "next-intl";
import type { FieldControlProps } from "../auth/auth-field";

const maxTags = 50;
const maxTagLength = 48;

/** Pick workspace tags or create one by typing it. */
export function TagsField({
  control,
  value,
  onChange,
  options,
  disabled = false,
}: {
  control: FieldControlProps;
  value: string[];
  onChange: (value: string[]) => void;
  /** Tags already in the workspace. */
  options: string[];
  disabled?: boolean;
}) {
  const t = useTranslations("common.tags");
  const names = [...new Set([...options, ...value])].sort((a, b) =>
    a.localeCompare(b),
  );
  return (
    <Combobox
      id={control.id}
      multiple
      options={names.map((name) => ({ value: name, label: name }))}
      value={value}
      onValueChange={(next) => onChange(next.slice(0, maxTags))}
      placeholder={t("placeholder")}
      searchPlaceholder={t("search")}
      emptyText={t("empty")}
      createLabel={(query) =>
        t("create", { tag: query.slice(0, maxTagLength) })
      }
      onCreate={(query) => {
        const tag = query.trim().slice(0, maxTagLength);
        if (tag && !value.includes(tag) && value.length < maxTags)
          onChange([...value, tag]);
      }}
      invalid={control["aria-invalid"] ?? false}
      disabled={disabled}
    />
  );
}
