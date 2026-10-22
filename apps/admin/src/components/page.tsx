import { cn } from "@shortn/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  href?: string;
}

/** Sticky 56px header: crumbs, title, count, then page controls. */
export function PageHeader({
  title,
  count,
  crumbs,
  children,
}: {
  title: ReactNode;
  count?: ReactNode;
  crumbs?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex min-h-page-header shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-bg px-gutter py-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        {crumbs?.map((crumb) => (
          <span
            key={crumb.label}
            className="flex items-baseline gap-2 text-small text-fg-muted"
          >
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="max-w-48 truncate hover:text-fg"
              >
                {crumb.label}
              </Link>
            ) : (
              crumb.label
            )}
            <span aria-hidden className="text-fg-subtle">
              /
            </span>
          </span>
        ))}
        <h1 className="min-w-0 truncate text-title font-semibold tracking-[-0.015em]">
          {title}
        </h1>
        {count === undefined ? null : (
          <span className="font-mono text-small whitespace-nowrap text-fg-muted tabular-nums">
            {count}
          </span>
        )}
      </div>
      {children ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {children}
        </div>
      ) : null}
    </header>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 px-gutter py-5", className)}>
      {children}
    </div>
  );
}

/** A titled block separated by a hairline, not a card. */
export function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <h2 className="text-small font-semibold">{title}</h2>
        {actions ? <div className="ml-auto flex gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Label/value pairs in a dense two-column grid. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,max-content)_1fr] gap-x-6 gap-y-1.5 text-small">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-fg-muted">{label}</dt>
          <dd className="min-w-0 break-words">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
