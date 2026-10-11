import type { Route } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export interface Crumb {
  href: Route;
  label: ReactNode;
}

/** A page title under its parents: `Section › Item › Edit`, parents linked. */
export function BreadcrumbTitle({
  trail,
  children,
}: {
  trail: Crumb[];
  children: ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {trail.map((crumb, at) => (
        <Fragment key={at}>
          <Link
            href={crumb.href}
            className="max-w-48 shrink-0 truncate text-fg-muted hover:text-fg max-sm:max-w-24"
          >
            {crumb.label}
          </Link>
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-fg-subtle"
          />
        </Fragment>
      ))}
      <span className="truncate">{children}</span>
    </span>
  );
}
