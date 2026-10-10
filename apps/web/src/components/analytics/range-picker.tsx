"use client";

import {
  Button,
  Field,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@shortn/ui";
import { CalendarRange } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import {
  formatDay,
  parseDay,
  rangePresets,
  withRange,
  type AnalyticsQuery,
} from "./query";
import { Segmented, segmentButton } from "./segmented";

export function RangePicker({
  query,
  onChange,
  className,
}: {
  query: AnalyticsQuery;
  onChange: (query: AnalyticsQuery) => void;
  className?: string | undefined;
}) {
  const t = useTranslations("analytics");
  const intlLocale = useIntlLocale();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: "", to: "", max: "" });
  const [invalid, setInvalid] = useState(false);

  const start = parseDay(query.from);
  const end = parseDay(query.to);
  const customLabel =
    query.range === "custom" && start && end
      ? new Intl.DateTimeFormat(intlLocale, {
          day: "numeric",
          month: "short",
        }).formatRange(start, end)
      : t("ranges.custom");

  const openCustom = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const today = new Date();
    const monthAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 29,
    );
    setDraft({
      from: query.from ?? formatDay(monthAgo),
      to: query.to ?? formatDay(today),
      max: formatDay(today),
    });
    setInvalid(false);
  };

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const from = parseDay(draft.from);
    const to = parseDay(draft.to);
    if (!from || !to || from > to) {
      setInvalid(true);
      return;
    }
    onChange(withRange(query, "custom", draft.from, draft.to));
    setOpen(false);
  };

  return (
    <Segmented
      label={t("range")}
      className={className}
      options={rangePresets.map((preset) => ({
        value: preset,
        label: t(`ranges.${preset}`),
        ariaLabel: t(`rangeLabels.${preset}`),
      }))}
      value={query.range === "custom" ? null : query.range}
      onValueChange={(range) => onChange(withRange(query, range))}
    >
      <Popover open={open} onOpenChange={openCustom}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-pressed={query.range === "custom"}
            className={segmentButton}
          >
            <CalendarRange aria-hidden className="size-3.5" />
            {customLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <form onSubmit={apply} className="flex flex-col gap-3">
            <p className="font-medium">{t("customRange")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("from")} htmlFor={`${id}-from`}>
                <Input
                  id={`${id}-from`}
                  type="date"
                  required
                  max={draft.max}
                  value={draft.from}
                  aria-invalid={invalid || undefined}
                  onChange={(event) => {
                    setDraft({ ...draft, from: event.target.value });
                    setInvalid(false);
                  }}
                  className="font-mono tabular-nums"
                />
              </Field>
              <Field label={t("to")} htmlFor={`${id}-to`}>
                <Input
                  id={`${id}-to`}
                  type="date"
                  required
                  max={draft.max}
                  value={draft.to}
                  aria-invalid={invalid || undefined}
                  onChange={(event) => {
                    setDraft({ ...draft, to: event.target.value });
                    setInvalid(false);
                  }}
                  className="font-mono tabular-nums"
                />
              </Field>
            </div>
            {invalid ? (
              <p role="alert" className="text-meta text-danger">
                {t("invalidRange")}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="self-end"
            >
              {t("apply")}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </Segmented>
  );
}
