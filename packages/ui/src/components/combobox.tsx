import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { fieldFrame } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface ComboboxOption {
  value: string;
  label: string;
  meta?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  multiple?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** Enables creating a value from the query; receives the query, returns the item label. */
  createLabel?: (query: string) => string;
  onCreate?: (query: string) => void;
  /** Replaces the default field-styled trigger. Must be a single focusable element. */
  trigger?: ReactNode;
  id?: string;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  invalid?: boolean;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  multiple = false,
  placeholder,
  searchPlaceholder,
  emptyText,
  createLabel,
  onCreate,
  trigger,
  id,
  className,
  contentClassName,
  align = "start",
  invalid,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const labels = options
    .filter((option) => selected.has(option.value))
    .map((option) => option.label);
  const trimmedQuery = query.trim();
  const canCreate =
    Boolean(createLabel && onCreate && trimmedQuery) &&
    !options.some(
      (option) => option.label.toLowerCase() === trimmedQuery.toLowerCase(),
    );

  const toggle = (next: string) => {
    if (!multiple) {
      onValueChange([next]);
      setOpen(false);
      return;
    }
    onValueChange(
      selected.has(next)
        ? value.filter((item) => item !== next)
        : [...value, next],
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ?? (
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className={cn(
              fieldFrame,
              "flex h-8 w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1 text-left text-small outline-none",
              "focus-visible:border-signal focus-visible:ring-1 focus-visible:ring-signal aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                labels.length === 0 && "text-fg-subtle",
              )}
            >
              {labels.length === 0 ? placeholder : labels.join(", ")}
            </span>
            <ChevronsUpDown
              aria-hidden
              className="size-4 shrink-0 text-fg-subtle"
            />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn(
          "w-(--radix-popover-trigger-width) min-w-60 p-0",
          contentClassName,
        )}
      >
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            frameClassName="h-10 px-3"
            className="text-small"
          />
          <CommandList className="max-h-64 p-1">
            <CommandEmpty className="py-5">
              {canCreate ? null : emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => toggle(option.value)}
                    className="h-8"
                    {...(option.meta ? { meta: option.meta } : {})}
                    icon={
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-4 place-items-center rounded-chip",
                          multiple && "border border-line-strong",
                          multiple &&
                            isSelected &&
                            "border-signal bg-signal text-signal-fg",
                        )}
                      >
                        <Check
                          className={cn(
                            "size-3",
                            multiple ? "text-current!" : "text-fg!",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                          strokeWidth={multiple ? 3 : 2}
                        />
                      </span>
                    }
                  >
                    {option.label}
                  </CommandItem>
                );
              })}
              {canCreate && createLabel && onCreate ? (
                <CommandItem
                  value={`create ${trimmedQuery}`}
                  className="h-8"
                  icon={<Plus aria-hidden />}
                  onSelect={() => {
                    onCreate(trimmedQuery);
                    setQuery("");
                  }}
                >
                  {createLabel(trimmedQuery)}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
