"use client";

import { buttonVariants, Checkbox, cn } from "@shortn/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { useSelection, writeSelection } from "@/lib/selection";

export interface Column {
  id: string;
  header: string;
  className?: string;
  align?: "left" | "right";
}

export interface Row {
  id: string;
  /** Opens on row click, Enter, or the first cell's link. */
  href?: string;
  cells: Record<string, ReactNode>;
}

export interface SelectionOptions {
  /** Storage key; one per list, e.g. "links". */
  key: string;
  max: number;
  /** The bulk action page that reads this selection. */
  action?: { href: string; label: string };
}

/**
 * The console's dense table (23 §2.0): 44px rows, hairlines, keyboard
 * navigation (j/k, Enter, x), and a stacked layout under 900px. Cells are
 * rendered on the server; long values truncate with the full text in a
 * title.
 */
export function DataTable({
  columns,
  rows,
  empty = "Nothing matches.",
  selection,
  caption,
}: {
  columns: Column[];
  rows: Row[];
  empty?: ReactNode;
  selection?: SelectionOptions;
  caption?: string;
}) {
  const router = useRouter();
  const body = useRef<HTMLTableSectionElement>(null);
  const selected = useSelection(selection?.key ?? "");
  const chosen = new Set(selection ? selected : []);
  const pageIds = rows.map((row) => row.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => chosen.has(id));
  const toggle = (id: string) => {
    if (!selection) return;
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else if (next.size < selection.max) next.add(id);
    writeSelection(selection.key, [...next]);
  };
  const togglePage = () => {
    if (!selection) return;
    const next = new Set(chosen);
    if (allOnPage) for (const id of pageIds) next.delete(id);
    else for (const id of pageIds) if (next.size < selection.max) next.add(id);
    writeSelection(selection.key, [...next]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (event.target !== event.currentTarget) return;
    const items = [
      ...(body.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row]") ??
        []),
    ];
    const index = items.indexOf(event.currentTarget);
    if (event.key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      items[index + 1]?.focus();
    } else if (event.key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      items[index - 1]?.focus();
    } else if (event.key === "Enter" && row.href) {
      router.push(row.href);
    } else if (event.key === "x" && selection) {
      toggle(row.id);
    }
  };

  const stacked = "max-[900px]:block";
  return (
    <div className="flex flex-col gap-2">
      {selection ? (
        <div className="flex min-h-8 flex-wrap items-center gap-3 text-small">
          <span
            className="font-mono tabular-nums text-fg-muted"
            aria-live="polite"
          >
            {chosen.size} selected · max {selection.max}
          </span>
          {chosen.size ? (
            <>
              <button
                type="button"
                className="text-signal hover:underline"
                onClick={() => writeSelection(selection.key, [])}
              >
                Clear selection
              </button>
              {selection.action ? (
                <Link
                  href={selection.action.href}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  {selection.action.label}
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className={cn("w-full border-collapse text-small", stacked)}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="max-[900px]:hidden">
            <tr className="h-9 border-b border-line bg-bg-subtle text-left text-meta font-medium text-fg-muted">
              {selection ? (
                <th className="w-9 px-3">
                  <Checkbox
                    aria-label="Select page"
                    checked={allOnPage}
                    onCheckedChange={togglePage}
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    "px-3 font-medium whitespace-nowrap",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={body} className={stacked}>
            {rows.length === 0 ? (
              <tr className={stacked}>
                <td
                  colSpan={columns.length + (selection ? 1 : 0)}
                  className="px-3 py-10 text-center text-fg-muted max-[900px]:block"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  data-row
                  tabIndex={0}
                  aria-selected={selection ? chosen.has(row.id) : undefined}
                  onKeyDown={(event) => onKeyDown(event, row)}
                  onClick={(event) => {
                    if (
                      !row.href ||
                      (event.target instanceof Element &&
                        event.target.closest(
                          "a,button,input,label,[role=checkbox]",
                        ))
                    )
                      return;
                    router.push(row.href);
                  }}
                  className={cn(
                    "border-b border-line outline-none focus-visible:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal",
                    row.href && "cursor-pointer",
                    chosen.has(row.id) ? "bg-bg-muted" : "hover:bg-bg-subtle",
                    "max-[900px]:flex max-[900px]:flex-wrap max-[900px]:gap-x-4 max-[900px]:gap-y-1 max-[900px]:px-3 max-[900px]:py-2.5",
                  )}
                >
                  {selection ? (
                    <td className="w-9 px-3 max-[900px]:w-auto max-[900px]:px-0">
                      <Checkbox
                        aria-label="Select row"
                        checked={chosen.has(row.id)}
                        disabled={
                          !chosen.has(row.id) && chosen.size >= selection.max
                        }
                        onCheckedChange={() => toggle(row.id)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      data-label={column.header}
                      className={cn(
                        "h-11 max-w-80 truncate px-3",
                        column.align === "right" && "text-right tabular-nums",
                        column.className,
                        "max-[900px]:h-auto max-[900px]:max-w-full max-[900px]:px-0 max-[900px]:text-left",
                        index === 0
                          ? "max-[900px]:w-full max-[900px]:font-medium"
                          : "max-[900px]:before:mr-1.5 max-[900px]:before:text-meta max-[900px]:before:text-fg-subtle max-[900px]:before:content-[attr(data-label)]",
                      )}
                    >
                      {index === 0 && row.href ? (
                        <Link
                          href={row.href}
                          className="font-medium hover:underline"
                        >
                          {row.cells[column.id] ?? "—"}
                        </Link>
                      ) : (
                        (row.cells[column.id] ?? "—")
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
