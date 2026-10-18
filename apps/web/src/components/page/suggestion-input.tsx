"use client";

import { Combobox } from "@shortn/ui";
import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { InputHTMLAttributes } from "react";
import { inputClass } from "./form";

/** A free-text field with a searchable menu of saved suggestions. */
export function SuggestionInput({
  label,
  suggestions,
  value,
  onValueChange,
  ...input
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "className"
> & {
  label: string;
  suggestions: readonly string[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const t = useTranslations("common.suggestions");
  const options = [...new Set(suggestions.filter(Boolean))].map((item) => ({
    value: item,
    label: item,
  }));
  return (
    <div className="relative min-w-0">
      <input
        {...input}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={`${inputClass} ${options.length ? "pr-10" : ""}`}
      />
      {options.length ? (
        <Combobox
          options={options}
          value={value ? [value] : []}
          onValueChange={(selected) => onValueChange(selected[0] ?? "")}
          placeholder={t("open", { field: label })}
          searchPlaceholder={t("search")}
          emptyText={t("empty")}
          contentClassName="w-72 max-w-[calc(100vw-2rem)]"
          align="end"
          disabled={Boolean(input.disabled)}
          trigger={
            <button
              type="button"
              role="combobox"
              aria-label={t("open", { field: label })}
              disabled={Boolean(input.disabled)}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-control text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-signal disabled:opacity-50"
            >
              <ChevronsUpDown aria-hidden className="size-4" />
            </button>
          }
        />
      ) : null}
    </div>
  );
}
