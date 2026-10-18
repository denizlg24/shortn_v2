"use client";

import { cn, Skeleton } from "@shortn/ui";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import type { SortColumn, TableRow, TableSort } from "./breakdowns";

const skeletonWidths = [92, 70, 52, 38, 26];

function RowLabel({
  label,
  href,
  active,
}: {
  label: string;
  href: string | null;
  active: boolean;
}) {
  const t = useTranslations("analytics.table");
  if (!href) return <span className="truncate">{label}</span>;
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      title={active ? t("clearFilter") : t("filterBy", { value: label })}
      className="truncate rounded-chip hover:underline focus-visible:outline-2 focus-visible:outline-signal aria-[current]:font-semibold"
    >
      {label}
    </Link>
  );
}

/** Overview breakdown: the top rows with a proportional bar, then "See all". */
export function TopTable({
  title,
  rows,
  loading,
  seeAllHref,
  rowHref,
  active,
}: {
  title: string;
  rows: TableRow[] | undefined;
  /** True only before the first result; later loads keep the old rows. */
  loading: boolean;
  seeAllHref: string | null;
  /** Where a row leads (sets its filter), or null when it can't filter. */
  rowHref: (value: string) => string | null;
  active: string | undefined;
}) {
  const t = useTranslations("analytics");
  const format = useFormatter();
  const headingId = useId();
  const items = rows ?? [];
  const max = Math.max(1, ...items.map((row) => row.clicks + row.scans));

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-small font-medium">
          {title}
        </h2>
        {seeAllHref && items.length ? (
          <Link
            href={seeAllHref}
            className="text-small text-signal hover:underline"
            aria-label={t("table.seeAllLabel", { title })}
          >
            {t("table.seeAll")}
          </Link>
        ) : null}
      </div>
      {loading ? (
        <ul aria-hidden className="border-y border-line">
          {skeletonWidths.map((width) => (
            <li key={width} className="flex h-9 items-center gap-3">
              <Skeleton className="h-5" style={{ width: `${width}%` }} />
              <Skeleton className="ml-auto h-3 w-8 shrink-0" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="border-y border-line py-3 text-small text-fg-muted">
          {t("empty")}
        </p>
      ) : (
        <table className="w-full table-fixed text-small">
          <thead className="sr-only">
            <tr>
              <th scope="col">{title}</th>
              <th scope="col">{t("table.total")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-y border-line">
            {items.map((row) => {
              const total = row.clicks + row.scans;
              return (
                <tr key={row.value}>
                  <th scope="row" className="relative py-2 pr-3 font-normal">
                    <span
                      aria-hidden
                      className="absolute inset-y-1 left-0 rounded-chip bg-signal-wash"
                      style={{ width: `${(total / max) * 100}%` }}
                    />
                    <span className="relative flex min-w-0 pl-2 text-left">
                      <RowLabel
                        label={row.label}
                        href={rowHref(row.value)}
                        active={row.value === active}
                      />
                    </span>
                  </th>
                  <td className="w-24 py-2 text-right font-mono text-fg-muted tabular-nums">
                    {format.number(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** A breakdown page's whole table, sortable by every column (17 §Analytics). */
export function FullTable({
  caption,
  nameLabel,
  rows,
  grandTotal,
  sort,
  sortHref,
  rowHref,
}: {
  caption: string;
  nameLabel: string;
  rows: TableRow[];
  grandTotal: number;
  sort: TableSort;
  sortHref: (column: SortColumn) => string;
  rowHref: (value: string) => string | null;
}) {
  const t = useTranslations("analytics.table");
  const format = useFormatter();

  const header = (column: SortColumn, label: string, className?: string) => {
    const sorted = sort.column === column;
    const Arrow = sort.direction === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={
          sorted
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : undefined
        }
        className={cn("py-2 font-medium", className)}
      >
        <Link
          href={sortHref(column)}
          scroll={false}
          className={cn(
            "inline-flex items-center gap-1 rounded-chip hover:text-fg focus-visible:outline-2 focus-visible:outline-signal",
            sorted && "text-fg",
          )}
        >
          {label}
          {sorted ? <Arrow aria-hidden className="size-3.5" /> : null}
        </Link>
      </th>
    );
  };

  const number = (value: number): ReactNode => format.number(value);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-small">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-left text-meta text-fg-muted">
          <tr>
            {header("name", nameLabel, "pr-4")}
            {header("clicks", t("clicks"), "pr-4 text-right max-sm:hidden")}
            {header("scans", t("scans"), "pr-4 text-right max-sm:hidden")}
            {header("total", t("total"), "pr-4 text-right")}
            <th scope="col" className="py-2 text-right font-medium">
              {t("share")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const total = row.clicks + row.scans;
            return (
              <tr key={row.value} className="hover:bg-bg-subtle">
                <th
                  scope="row"
                  className="max-w-0 py-2.5 pr-4 text-left font-normal"
                >
                  <span className="flex min-w-0">
                    <RowLabel
                      label={row.label}
                      href={rowHref(row.value)}
                      active={false}
                    />
                  </span>
                </th>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums max-sm:hidden">
                  {number(row.clicks)}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums max-sm:hidden">
                  {number(row.scans)}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                  {number(total)}
                </td>
                <td className="py-2.5 text-right font-mono text-fg-muted tabular-nums">
                  {format.number(grandTotal > 0 ? total / grandTotal : 0, {
                    style: "percent",
                    maximumFractionDigits: 1,
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
