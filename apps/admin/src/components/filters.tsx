"use client";

import { buttonVariants, cn } from "@shortn/ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, type ReactNode } from "react";

// Explicit, labelled filters whose state lives in the URL (23 §2.0), ported
// from the dashboard's filter bar. Choices apply immediately; text applies
// on Enter or Apply. Any change drops the page cursor.
const cursorParams = ["after", "before"];

export function Filters({
  children,
  applied = [],
  keep = [],
}: {
  children: ReactNode;
  /** Human-readable summary, e.g. ["Plan: Pro", "Locked"]. */
  applied?: string[];
  /** Params kept when filtering and clearing (e.g. a tab). */
  keep?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const form = useRef<HTMLFormElement>(null);
  const kept = () => {
    const params = new URLSearchParams();
    for (const name of keep)
      for (const value of current.getAll(name)) params.append(name, value);
    return params;
  };
  const apply = () => {
    if (!form.current) return;
    const next = kept();
    for (const [key, value] of new FormData(form.current))
      if (typeof value === "string" && value !== "" && !keep.includes(key))
        next.append(key, value);
    for (const name of cursorParams) next.delete(name);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };
  const clear = kept().toString();
  return (
    <form
      ref={form}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      onChange={(event) => {
        if (
          event.target instanceof HTMLSelectElement ||
          (event.target instanceof HTMLInputElement &&
            !["search", "text"].includes(event.target.type))
        )
          apply();
      }}
      className="flex flex-col gap-3 border-b border-line pb-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <button
          type="submit"
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          Apply
        </button>
      </div>
      {applied.length ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-muted">
          <span>Filtered by</span>
          {applied.map((item) => (
            <span
              key={item}
              className="max-w-64 truncate rounded-chip bg-bg-muted px-1.5 py-0.5 text-fg"
              title={item}
            >
              {item}
            </span>
          ))}
          <Link
            href={clear ? `${pathname}?${clear}` : pathname}
            className="text-signal hover:underline"
          >
            Clear
          </Link>
        </p>
      ) : null}
    </form>
  );
}

const control =
  "h-8 rounded-control border border-line-strong bg-field px-2.5 text-small text-fg focus-visible:outline-2 focus-visible:outline-signal";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-meta font-medium text-fg-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

export function FilterSearch({
  label,
  name = "q",
  placeholder,
}: {
  label: string;
  name?: string;
  placeholder?: string;
}) {
  const value = useSearchParams().get(name) ?? "";
  return (
    <Field label={label} className="min-w-56 flex-1">
      {(id) => (
        <input
          id={id}
          type="search"
          name={name}
          defaultValue={value}
          key={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={cn(control, "w-full")}
        />
      )}
    </Field>
  );
}

export function FilterSelect({
  label,
  name,
  options,
  allLabel = "All",
}: {
  label: string;
  name: string;
  options: readonly { value: string; label: string }[];
  /** The "no filter" choice; null when the select always has a value. */
  allLabel?: string | null;
}) {
  const fromUrl = useSearchParams().get(name);
  const value = fromUrl ?? (allLabel === null ? (options[0]?.value ?? "") : "");
  return (
    <Field label={label}>
      {(id) => (
        <select
          id={id}
          name={name}
          defaultValue={value}
          key={value}
          className={cn(control, "max-w-56 pr-7")}
        >
          {allLabel === null ? null : <option value="">{allLabel}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function FilterDate({ label, name }: { label: string; name: string }) {
  const value = useSearchParams().get(name) ?? "";
  return (
    <Field label={label}>
      {(id) => (
        <input
          id={id}
          type="date"
          name={name}
          defaultValue={value}
          key={value}
          className={control}
        />
      )}
    </Field>
  );
}
