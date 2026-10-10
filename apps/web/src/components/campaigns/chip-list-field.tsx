"use client";

import { cn, fieldFrame } from "@shortn/ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import type { FieldControlProps } from "../auth/auth-field";

const maxValues = 100;
const maxLength = 100;

// The server stores defaults lowercased and trimmed; doing it while typing
// shows exactly what will be saved.
const normalize = (value: string) =>
  value.trim().toLowerCase().slice(0, maxLength);

/** A list of short values typed one by one: Enter or comma adds, Backspace on an empty field removes the last. */
export function ChipListField({
  control,
  values,
  onChange,
  placeholder,
  disabled = false,
}: {
  control: FieldControlProps;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const t = useTranslations("campaigns.chips");
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const fresh = raw
      .split(",")
      .map(normalize)
      .filter((value, at, all) => value && all.indexOf(value) === at)
      .filter((value) => !values.includes(value));
    if (fresh.length) onChange([...values, ...fresh].slice(0, maxValues));
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && values.length) {
      event.preventDefault();
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        fieldFrame,
        "flex min-h-8 flex-wrap items-center gap-1 px-1.5 py-1",
      )}
    >
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex h-6 max-w-full items-center gap-0.5 rounded-chip bg-fg/6 pr-0.5 pl-1.5 font-mono text-meta text-fg"
        >
          <span className="truncate">{value}</span>
          <button
            type="button"
            aria-label={t("remove", { value })}
            disabled={disabled}
            onClick={() => onChange(values.filter((item) => item !== value))}
            className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-chip text-fg-subtle hover:bg-fg/8 hover:text-fg disabled:cursor-not-allowed"
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      <input
        {...control}
        value={draft}
        disabled={disabled || values.length >= maxValues}
        maxLength={maxLength}
        placeholder={values.length ? undefined : placeholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        onChange={(event) => {
          const value = event.target.value;
          if (value.includes(",")) add(value);
          else setDraft(value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim()) add(draft);
        }}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-small outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed"
      />
    </div>
  );
}
