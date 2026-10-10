"use client";

import { buttonVariants, cn } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, type ReactNode } from "react";

// Explicit, labelled filters (12 superseded IA): a plain GET form, so every
// filter lives in the URL and works without JS. With JS a change applies at
// once; the Apply button stays for keyboard and no-JS users.
export function FilterBar({
  children,
  applied,
}: {
  children: ReactNode;
  // Human-readable summary of what is filtered, e.g. ["Tags: Print", "Last 30 days"].
  applied: string[];
}) {
  const t = useTranslations("page.filters");
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);

  const apply = () => {
    if (!form.current) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form.current))
      if (typeof value === "string" && value !== "") params.append(key, value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <form
      ref={form}
      method="get"
      role="search"
      aria-label={t("label")}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      onChange={(event) => {
        // Text fields apply on Enter/Apply; choices apply immediately.
        if (
          event.target instanceof HTMLSelectElement ||
          (event.target instanceof HTMLInputElement &&
            event.target.type !== "search" &&
            event.target.type !== "text")
        )
          apply();
      }}
      className="mb-6 flex flex-col gap-3 border-b border-line pb-5"
    >
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <button
          type="submit"
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("apply")}
        </button>
      </div>
      {applied.length ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-muted">
          <span>{t("applied")}</span>
          {applied.map((item) => (
            <span
              key={item}
              className="rounded-chip bg-bg-muted px-1.5 py-0.5 text-fg"
            >
              {item}
            </span>
          ))}
          <Link href={pathname} className="text-signal hover:underline">
            {t("clear")}
          </Link>
        </p>
      ) : null}
    </form>
  );
}

const control =
  "h-8 rounded-control border border-line-strong bg-field px-2.5 text-small text-fg focus-visible:outline-2 focus-visible:outline-signal";

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = `filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  const value = useSearchParams().get(name) ?? "";
  return (
    <FilterField label={label} className="min-w-56 flex-1">
      {(id) => (
        <input
          id={id}
          type="search"
          name={name}
          defaultValue={value}
          placeholder={placeholder}
          className={cn(control, "w-full")}
        />
      )}
    </FilterField>
  );
}

export function FilterSelect({
  label,
  name,
  options,
  allLabel,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  // The "no filter" choice; omit when the select always has a value (sort).
  allLabel?: string;
}) {
  const value =
    useSearchParams().get(name) ?? (allLabel ? "" : (options[0]?.value ?? ""));
  return (
    <FilterField label={label}>
      {(id) => (
        <select
          id={id}
          name={name}
          defaultValue={value}
          key={value}
          className={cn(control, "pr-7")}
        >
          {allLabel ? <option value="">{allLabel}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FilterField>
  );
}

export function FilterDate({ label, name }: { label: string; name: string }) {
  const value = useSearchParams().get(name) ?? "";
  return (
    <FilterField label={label}>
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
    </FilterField>
  );
}
