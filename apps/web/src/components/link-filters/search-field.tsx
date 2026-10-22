"use client";

import { cn } from "@shortn/ui";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const settleMs = 300;

/**
 * Applies on Enter or once typing pauses. A value echoed back from its own
 * commit keeps newer keystrokes; any other change (Clear all, back) replaces them.
 */
export function SearchField({
  value,
  onCommit,
  label,
  placeholder,
  clearLabel,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  placeholder: string;
  clearLabel: string;
  className?: string;
}) {
  const [draft, setDraft] = useState({
    text: value,
    source: value,
    sent: value,
  });
  if (draft.source !== value)
    setDraft({
      text: value === draft.sent ? draft.text : value,
      source: value,
      sent: value,
    });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Handlers compare against the latest request, which may not be in the URL yet.
  const lastSent = useRef(value);
  useEffect(() => {
    lastSent.current = value;
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const commit = (text: string) => {
    clearTimeout(timer.current);
    const next = text.slice(0, 200).trim();
    if (next === lastSent.current.trim()) return;
    lastSent.current = next;
    setDraft((current) => ({ ...current, sent: next }));
    onCommit(next);
  };
  return (
    <div
      className={cn(
        "flex h-8 min-w-0 items-center gap-2 rounded-control border border-line-strong bg-field px-2.5 text-small",
        "focus-within:border-signal focus-within:ring-1 focus-within:ring-signal",
        className,
      )}
    >
      <Search aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        maxLength={200}
        value={draft.text}
        onChange={(event) => {
          const text = event.target.value;
          setDraft((current) => ({ ...current, text }));
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(text), settleMs);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft.text);
          }
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-subtle [&::-webkit-search-cancel-button]:hidden"
      />
      {draft.text ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            setDraft((current) => ({ ...current, text: "" }));
            commit("");
          }}
          className="-mr-1 grid size-6 shrink-0 cursor-pointer place-items-center rounded-chip text-fg-subtle hover:bg-bg-muted hover:text-fg"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
