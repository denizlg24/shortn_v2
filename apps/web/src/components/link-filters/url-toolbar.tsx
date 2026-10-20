"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useOptimistic, useTransition } from "react";
import { LinkToolbar, type LinkToolbarProps } from "./toolbar";
import {
  clearLinkFilters,
  linkFiltersFrom,
  linkFiltersSearch,
  type LinkFilterState,
} from "./state";

/**
 * The link toolbar bound to the URL, its single source of truth. Changes
 * replace the URL in a transition; the toolbar shows them optimistically so
 * quick successive choices build on each other.
 */
export function UrlLinkToolbar({
  counts = true,
  ...props
}: Omit<
  LinkToolbarProps,
  "value" | "onChange" | "pending" | "clearHref" | "countView"
> & {
  /** False on review pages, where workspace-wide counts would mislead. */
  counts?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = useMemo(() => linkFiltersFrom(params), [params]);
  const [value, setValue] = useOptimistic(fromUrl);
  const [pending, startTransition] = useTransition();
  const href = (state: LinkFilterState) => {
    const search = linkFiltersSearch(
      state,
      new URLSearchParams(params),
    ).toString();
    return search ? `${pathname}?${search}` : pathname;
  };
  // Tag counts ignore tag choices, so toggling tags never refetches them.
  const countView = counts
    ? linkFiltersSearch(
        {
          ...value,
          tags: [],
          untagged: false,
          tagMode: "any",
          sort: "newest",
          group: null,
        },
        new URLSearchParams(params),
      ).toString()
    : null;
  return (
    <LinkToolbar
      {...props}
      value={value}
      pending={pending}
      countView={countView}
      clearHref={href(clearLinkFilters(value))}
      onChange={(next) =>
        startTransition(() => {
          setValue(next);
          router.replace(href(next), { scroll: false });
        })
      }
    />
  );
}
