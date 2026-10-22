import { buttonVariants, cn } from "@shortn/ui";
import Link from "next/link";
import type { SearchParams } from "@/server/list";

function href(search: SearchParams, cursor: Record<string, string>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (key === "after" || key === "before" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value])
      next.append(key, item);
  }
  for (const [key, value] of Object.entries(cursor)) next.set(key, value);
  return `?${next}`;
}

/** Prev/next over keyset cursors; there's no "page N of M" (23 §2.0). */
export function Pager({
  search,
  next,
  prev,
}: {
  search: SearchParams;
  next?: string | undefined;
  prev?: string | undefined;
}) {
  if (!next && !prev) return null;
  const link = (label: string, cursor: Record<string, string> | null) =>
    cursor ? (
      <Link
        href={href(search, cursor)}
        className={buttonVariants({ variant: "secondary", size: "md" })}
      >
        {label}
      </Link>
    ) : (
      <span
        aria-disabled
        className={cn(
          buttonVariants({ variant: "secondary", size: "md" }),
          "opacity-50",
        )}
      >
        {label}
      </span>
    );
  return (
    <nav aria-label="Pages" className="flex items-center gap-2 text-small">
      {link("Previous", prev ? { before: prev } : null)}
      {link("Next", next ? { after: next } : null)}
    </nav>
  );
}
