"use client";

import { isTagSort, tagSorts, type TagSort } from "@shortn/core/tag-options";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@shortn/ui";
import { ArrowDownUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { SearchField } from "../link-filters/search-field";

/** Search and sort for the tag library; both live in the URL. */
export function TagLibraryToolbar({ total }: { total: number }) {
  const t = useTranslations("tags");
  const filters = useTranslations("linkFilters");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sortParam = params.get("sort");
  const [value, setValue] = useOptimistic({
    search: (params.get("q") ?? "").slice(0, 200),
    sort: isTagSort(sortParam) ? sortParam : ("name" satisfies TagSort),
  });
  const [pending, startTransition] = useTransition();
  const go = (next: typeof value) =>
    startTransition(() => {
      setValue(next);
      const search = new URLSearchParams(params);
      search.delete("page");
      for (const flag of ["saved", "merged", "deleted"]) search.delete(flag);
      if (next.search) search.set("q", next.search);
      else search.delete("q");
      if (next.sort === "name") search.delete("sort");
      else search.set("sort", next.sort);
      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  return (
    <div
      role="search"
      aria-label={t("search")}
      aria-busy={pending || undefined}
      className="mb-4 flex min-w-0 items-center gap-2"
    >
      <SearchField
        value={value.search}
        onCommit={(search) => go({ ...value, search })}
        label={t("search")}
        placeholder={t("searchPlaceholder")}
        clearLabel={filters("clearSearch")}
        className="w-full sm:max-w-80"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="md"
            aria-label={t("sortLabel", { sort: t(`sorts.${value.sort}`) })}
            className="max-sm:w-8 max-sm:px-0"
          >
            <ArrowDownUp aria-hidden />
            <span className="max-sm:hidden">{t(`sorts.${value.sort}`)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("sort")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value.sort}
            onValueChange={(sort) => {
              if (isTagSort(sort)) go({ ...value, sort });
            }}
          >
            {tagSorts.map((sort) => (
              <DropdownMenuRadioItem key={sort} value={sort}>
                {t(`sorts.${sort}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span
        aria-live="polite"
        className={cn(
          "ml-auto text-small whitespace-nowrap text-fg-muted tabular-nums transition-opacity duration-(--motion-fast)",
          pending && "opacity-50",
        )}
      >
        {t("count", { count: total })}
      </span>
    </div>
  );
}
