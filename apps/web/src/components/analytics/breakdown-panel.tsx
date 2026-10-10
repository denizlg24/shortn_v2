"use client";

import type { PlanId } from "@shortn/billing";
import type { BreakdownRow, Dimension } from "@shortn/core";
import { BarList, Button, cn, Skeleton } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { PlanGate } from "../plan-gate";

const skeletonWidths = [92, 64, 48, 33, 21];

export function BreakdownPanel({
  dimension,
  title,
  rows,
  loading,
  gate,
  onSelect,
  valueLabel,
  limit = 8,
  className,
}: {
  dimension: Dimension;
  title: string;
  rows: BreakdownRow[] | undefined;
  /** True only before the first result; later loads keep the old rows. */
  loading: boolean;
  /** The plan that unlocks this breakdown, when the current plan doesn't. */
  gate: PlanId | null;
  onSelect?: (value: string) => void;
  valueLabel: (dimension: Dimension, value: string) => string;
  limit?: number;
  className?: string | undefined;
}) {
  const t = useTranslations("analytics");
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const items = (rows ?? []).map((row) => ({
    id: row.value,
    label: valueLabel(dimension, row.value),
    value: row.clicks + row.scans,
  }));
  const shown = expanded ? items : items.slice(0, limit);

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex min-w-0 flex-col gap-2", className)}
    >
      <h2 id={headingId} className="text-small font-medium text-fg">
        {title}
      </h2>
      {gate ? (
        <PlanGate feature="analyticsBreakdowns" plan={gate} className="py-3" />
      ) : loading ? (
        <ul aria-hidden className="flex flex-col">
          {skeletonWidths.map((width) => (
            <li key={width} className="flex h-8 items-center gap-3">
              <Skeleton className="h-6" style={{ width: `${width}%` }} />
              <Skeleton className="ml-auto h-3 w-8 shrink-0" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="py-3 text-small text-fg-muted">{t("empty")}</p>
      ) : (
        <>
          <BarList
            label={title}
            items={shown}
            {...(onSelect ? { onSelect: (item) => onSelect(item.id) } : {})}
          />
          {items.length > limit ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 self-start"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded
                ? t("showFewer")
                : t("showAll", { count: items.length })}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
