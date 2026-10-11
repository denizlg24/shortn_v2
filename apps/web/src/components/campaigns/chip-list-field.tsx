"use client";

import { cn } from "@shortn/ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";

const maxValues = 100;
const maxLength = 100;

// The server stores defaults lowercased and trimmed; doing it while typing
// shows exactly what will be saved.
const normalize = (value: string) =>
  value.trim().toLowerCase().slice(0, maxLength);

/**
 * A list of short values typed one by one: Enter or comma adds, Backspace on
 * an empty field removes the last. Each value posts as `name`.
 */
export function ChipListField({
  id,
  name,
  initial,
  placeholder,
  describedBy,
}: {
  id: string;
  name: string;
  initial: string[];
  placeholder: string;
  describedBy?: string;
}) {
  const t = useTranslations("campaigns.chips");
  const [values, setValues] = useState(initial);
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const fresh = raw
      .split(",")
      .map(normalize)
      .filter((value, at, all) => value && all.indexOf(value) === at)
      .filter((value) => !values.includes(value));
    if (fresh.length) setValues([...values, ...fresh].slice(0, maxValues));
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && values.length) {
      event.preventDefault();
      setValues(values.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1 rounded-control border border-line-strong bg-field px-1.5 py-1",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-signal",
      )}
    >
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex h-6 max-w-full items-center gap-0.5 rounded-chip bg-bg-muted pr-0.5 pl-1.5 font-mono text-meta text-fg"
        >
          <input type="hidden" name={name} value={value} />
          <span className="truncate">{value}</span>
          <button
            type="button"
            aria-label={t("remove", { value })}
            onClick={() => setValues(values.filter((item) => item !== value))}
            className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-chip text-fg-subtle hover:bg-fg/8 hover:text-fg"
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        disabled={values.length >= maxValues}
        maxLength={maxLength}
        placeholder={values.length ? undefined : placeholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-describedby={describedBy}
        onChange={(event) => {
          const value = event.target.value;
          if (value.includes(",")) add(value);
          else setDraft(value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim()) add(draft);
        }}
        className="h-7 min-w-24 flex-1 bg-transparent px-1 text-body outline-none placeholder:text-fg-subtle"
      />
    </div>
  );
}
