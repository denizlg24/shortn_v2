import { Check, ChevronLeft, ListFilter, X } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useUILocale } from "../i18n/provider";
import { cn } from "../lib/cn";
import { Button } from "./button";
import type { ComboboxOption } from "./combobox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface FilterField {
  id: string;
  label: string;
  icon?: ReactNode;
  options: ComboboxOption[];
  searchPlaceholder?: string;
}

export type FilterValue = Record<string, string[]>;

export interface FilterBarProps {
  fields: FilterField[];
  value: FilterValue;
  onValueChange: (next: FilterValue) => void;
  /** Placeholder for the field picker search, e.g. "Filter by…". */
  pickerPlaceholder: string;
  className?: string;
}

export function FilterBar({
  fields,
  value,
  onValueChange,
  pickerPlaceholder,
  className,
}: FilterBarProps) {
  const { t } = useUILocale();
  const active = fields.filter((field) => (value[field.id]?.length ?? 0) > 0);
  const setField = (fieldId: string, next: string[]) => {
    const updated = { ...value };
    if (next.length === 0) delete updated[fieldId];
    else updated[fieldId] = next;
    onValueChange(updated);
  };

  return (
    <div
      role="group"
      aria-label={t.addFilter}
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
    >
      {active.map((field) => (
        <FilterChip
          key={field.id}
          field={field}
          selected={value[field.id] ?? []}
          onChange={(next) => setField(field.id, next)}
        />
      ))}
      <AddFilter
        fields={fields}
        value={value}
        onPick={setField}
        placeholder={pickerPlaceholder}
        compact={active.length > 0}
      />
      {active.length > 1 ? (
        <Button variant="ghost" size="sm" onClick={() => onValueChange({})}>
          {t.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}

function summarize(field: FilterField, selected: string[]): string {
  const labels = selected.map(
    (id) => field.options.find((option) => option.value === id)?.label ?? id,
  );
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]}, +${labels.length - 1}`;
}

function FilterChip({
  field,
  selected,
  onChange,
}: {
  field: FilterField;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useUILocale();
  const summary = summarize(field, selected);
  const operator = selected.length > 1 ? t.filterIsAnyOf : t.filterIs;
  return (
    <span className="inline-flex h-7 max-w-full min-w-0 items-stretch rounded-control border border-line-strong bg-field text-small">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 cursor-pointer items-center gap-1 rounded-l-[5px] py-0.5 pr-1.5 pl-2 outline-offset-0 hover:bg-bg-subtle aria-expanded:bg-bg-subtle"
          >
            <span className="shrink-0 text-fg-muted">{field.label}</span>
            <span className="shrink-0 text-fg-subtle">{operator}</span>
            <span className="max-w-44 truncate font-medium text-fg">
              {summary}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <OptionList field={field} selected={selected} onChange={onChange} />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label={t.removeFilter(`${field.label} ${operator} ${summary}`)}
        onClick={() => onChange([])}
        className="grid w-6 shrink-0 cursor-pointer place-items-center rounded-r-[5px] border-l border-line text-fg-subtle outline-offset-0 hover:bg-bg-subtle hover:text-fg"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}

function OptionList({
  field,
  selected,
  onChange,
  onBack,
}: {
  field: FilterField;
  selected: string[];
  onChange: (next: string[]) => void;
  onBack?: () => void;
}) {
  const { t } = useUILocale();
  const [query, setQuery] = useState("");
  const chosen = new Set(selected);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (onBack && event.key === "Backspace" && query === "") {
      event.preventDefault();
      onBack();
    }
  };
  return (
    <Command onKeyDown={handleKeyDown}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={field.searchPlaceholder ?? field.label}
        frameClassName="h-10 px-3"
        className="text-small"
        autoFocus
        trailing={
          onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={field.label}
              className="-mr-1 rounded-chip p-0.5 text-fg-subtle hover:text-fg"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
          ) : null
        }
      />
      <CommandList className="max-h-72 p-1">
        <CommandEmpty className="py-5">{t.noResults}</CommandEmpty>
        <CommandGroup>
          {field.options.map((option) => {
            const isChosen = chosen.has(option.value);
            return (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.value}`}
                className="h-8"
                {...(option.meta ? { meta: option.meta } : {})}
                onSelect={() =>
                  onChange(
                    isChosen
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value],
                  )
                }
                icon={
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-4 place-items-center rounded-chip border border-line-strong",
                      isChosen && "border-signal bg-signal text-signal-fg",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-3 text-current!",
                        !isChosen && "opacity-0",
                      )}
                      strokeWidth={3}
                    />
                  </span>
                }
              >
                {option.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function AddFilter({
  fields,
  value,
  onPick,
  placeholder,
  compact,
}: {
  fields: FilterField[];
  value: FilterValue;
  onPick: (fieldId: string, next: string[]) => void;
  placeholder: string;
  compact: boolean;
}) {
  const { t } = useUILocale();
  const [open, setOpen] = useState(false);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const field = fields.find((candidate) => candidate.id === fieldId);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFieldId(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon-sm" : "sm"}
          aria-label={t.addFilter}
          {...(compact ? { tooltip: t.addFilter } : {})}
        >
          <ListFilter aria-hidden />
          {compact ? null : t.addFilter}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        {field ? (
          <OptionList
            field={field}
            selected={value[field.id] ?? []}
            onChange={(next) => onPick(field.id, next)}
            onBack={() => setFieldId(null)}
          />
        ) : (
          <Command>
            <CommandInput
              placeholder={placeholder}
              frameClassName="h-10 px-3"
              className="text-small"
              autoFocus
            />
            <CommandList className="p-1">
              <CommandEmpty className="py-5">{t.noResults}</CommandEmpty>
              <CommandGroup>
                {fields.map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={candidate.label}
                    className="h-8"
                    icon={candidate.icon}
                    onSelect={() => setFieldId(candidate.id)}
                    {...((value[candidate.id]?.length ?? 0) > 0
                      ? { meta: String(value[candidate.id]?.length) }
                      : {})}
                  >
                    {candidate.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
