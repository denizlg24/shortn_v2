"use client";

import { buttonVariants, cn, Combobox } from "@shortn/ui";
import { ChevronsUpDown, X } from "lucide-react";
import { LinkPicker } from "../editor/link-picker";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Typing a year into a date field produces a valid date per keystroke
// (0002, 0020, …), so date changes settle before they apply.
const dateSettleMs = 700;
const FilterContext = createContext<
  ((name: string, values: string[]) => void) | null
>(null);

// Explicit, labelled filters (12 superseded IA): choices live in the URL.
// Native fields submit by GET; searchable choices apply through the router.
// Apply also submits a typed search or pending date change.
export function FilterBar({
  children,
  applied,
  normalize,
  clearParams = {},
}: {
  children: ReactNode;
  /** Page-owned scope retained when clearing filters. */
  clearParams?: Record<string, string> | undefined;
  // Human-readable summary of what is filtered, e.g. ["Tags: Print", "Last 30 days"].
  applied: string[];
  // Rewrites the submitted params before navigating, given the current ones
  // (e.g. fill in dates when "Custom" is picked, drop defaults).
  normalize?: (
    next: URLSearchParams,
    current: URLSearchParams,
  ) => URLSearchParams;
}) {
  const t = useTranslations("page.filters");
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const form = useRef<HTMLFormElement>(null);
  const dateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(dateTimer.current), []);

  const apply = (override?: { name: string; values: string[] }) => {
    clearTimeout(dateTimer.current);
    if (!form.current) return;
    const submitted = new URLSearchParams();
    for (const [key, value] of new FormData(form.current))
      if (typeof value === "string" && value !== "")
        submitted.append(key, value);
    if (override) {
      submitted.delete(override.name);
      for (const value of override.values)
        if (value) submitted.append(override.name, value);
    }
    const params = normalize
      ? normalize(submitted, new URLSearchParams(current))
      : submitted;
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
          event.target instanceof HTMLInputElement &&
          event.target.type === "date"
        ) {
          clearTimeout(dateTimer.current);
          dateTimer.current = setTimeout(() => apply(), dateSettleMs);
        } else if (
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
        <FilterContext.Provider
          value={(name, values) => apply({ name, values })}
        >
          {children}
        </FilterContext.Provider>
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
          <Link
            href={`${pathname}${new URLSearchParams(clearParams).size ? `?${new URLSearchParams(clearParams)}` : ""}`}
            className="text-signal hover:underline"
          >
            {t("clear")}
          </Link>
        </p>
      ) : null}
    </form>
  );
}

const control =
  "h-8 rounded-control border border-line-strong bg-field px-2.5 text-small text-fg focus-visible:outline-2 focus-visible:outline-signal";

export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-wrap items-end gap-3 border-line sm:border-r sm:pr-4 last:border-r-0 last:pr-0">
      <legend className="mb-2 text-meta font-medium text-fg-muted">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: (id: string) => ReactNode;
  className?: string;
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
          key={value}
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
  value: selected,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  // The "no filter" choice; omit when the select always has a value (sort).
  allLabel?: string;
  // The effective choice when it isn't simply the URL param (derived defaults).
  value?: string;
}) {
  const fromUrl = useSearchParams().get(name);
  const value =
    selected ?? fromUrl ?? (allLabel ? "" : (options[0]?.value ?? ""));
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

/** Searchable choices for tags, links and analytics dimensions. */
export function FilterCombobox({
  label,
  name,
  options,
  allLabel,
  multiple = false,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  allLabel: string;
  multiple?: boolean;
}) {
  const params = useSearchParams();
  return (
    <FilterChoices
      {...{ label, name, options, allLabel, multiple }}
      initial={params.getAll(name)}
    />
  );
}

function FilterChoices({
  label,
  name,
  options,
  allLabel,
  multiple,
  initial,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  allLabel: string;
  multiple: boolean;
  initial: string[];
}) {
  const t = useTranslations("page.filters");
  const apply = useContext(FilterContext);
  const initialValues = [...new Set(initial.filter(Boolean))];
  const source = JSON.stringify(initialValues);
  const [selection, setSelection] = useState({ source, values: initialValues });
  // Keep the popover mounted while navigation settles, and restore choices
  // when the URL changes through back/forward or Clear all.
  if (selection.source !== source)
    setSelection({ source, values: initialValues });
  const values = selection.source === source ? selection.values : initialValues;
  const setValues = (values: string[]) => setSelection({ source, values });
  const choices = options.filter((option) => option.value !== "");
  for (const value of values)
    if (!choices.some((choice) => choice.value === value))
      choices.push({ value, label: value });
  if (!multiple) choices.unshift({ value: "", label: allLabel });
  return (
    <FilterField label={label} className="w-full sm:w-48">
      {(id) => (
        <>
          {values.map((value) => (
            <input key={value} type="hidden" name={name} value={value} />
          ))}
          <Combobox
            id={id}
            multiple={multiple}
            options={choices}
            value={values}
            placeholder={allLabel}
            searchPlaceholder={t("searchOptions")}
            emptyText={t("noOptions")}
            onValueChange={(next) => {
              // "Any" clears the filter; it is never a selected fallback.
              const selected = [...new Set(next.filter(Boolean))];
              setValues(selected);
              apply?.(name, selected);
            }}
          />
          {multiple && values.length ? (
            <div className="flex flex-wrap gap-1">
              {values.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={t("remove", { value })}
                  className="inline-flex max-w-full items-center gap-1 rounded-chip bg-bg-muted px-1.5 py-0.5 text-meta text-fg hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-signal"
                  onClick={() => {
                    const next = values.filter((item) => item !== value);
                    setValues(next);
                    apply?.(name, next);
                  }}
                >
                  <span className="truncate">
                    {choices.find((choice) => choice.value === value)?.label ??
                      value}
                  </span>
                  <X aria-hidden className="size-3 shrink-0" />
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </FilterField>
  );
}

/** Searches all workspace links, including those outside the first page. */
export function FilterLink({
  workspace,
  label,
  allLabel,
  options,
}: {
  workspace: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  const params = useSearchParams();
  const apply = useContext(FilterContext);
  const t = useTranslations("page.filters");
  const [picked, setPicked] = useState<{ value: string; label: string } | null>(
    null,
  );
  const selected = params.get("link");
  const active =
    picked?.value === selected
      ? picked
      : options.find((option) => option.value === selected);
  const shown = active?.label ?? selected ?? allLabel;
  return (
    <FilterField label={label} className="w-full sm:w-64">
      {(id) => (
        <div className="flex min-w-0 items-center gap-1">
          {selected ? (
            <input type="hidden" name="link" value={selected} />
          ) : null}
          <LinkPicker
            workspace={workspace}
            onSelect={(link) => {
              setPicked({
                value: link.id,
                label: link.title
                  ? `/${link.key} · ${link.title}`
                  : `/${link.key}`,
              });
              apply?.("link", [link.id]);
            }}
            trigger={
              <button
                id={id}
                type="button"
                role="combobox"
                className={cn(
                  control,
                  "flex min-w-0 flex-1 items-center justify-between gap-2 text-left",
                )}
              >
                <span className="truncate">{shown}</span>
                <ChevronsUpDown
                  aria-hidden
                  className="size-4 shrink-0 text-fg-subtle"
                />
              </button>
            }
          />
          {selected ? (
            <button
              type="button"
              aria-label={t("remove", { value: shown })}
              onClick={() => apply?.("link", [])}
              className="grid size-8 shrink-0 place-items-center rounded-control text-fg-muted hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-signal"
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>
      )}
    </FilterField>
  );
}
