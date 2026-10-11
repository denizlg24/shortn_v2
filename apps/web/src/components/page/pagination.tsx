import { buttonVariants, cn } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

type Params = Record<string, string | string[] | undefined>;

function hrefFor(params: Params, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || key === "deleted" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value])
      search.append(key, item);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `?${query}` : "?";
}

export async function Pagination({
  page,
  pages,
  params,
}: {
  page: number;
  pages: number;
  params: Params;
}) {
  if (pages <= 1) return null;
  const t = await getTranslations("linkPages.list");
  const link = (target: number, label: string, disabled: boolean) =>
    disabled ? (
      <span
        aria-disabled
        className={cn(
          buttonVariants({ variant: "secondary", size: "md" }),
          "opacity-50",
        )}
      >
        {label}
      </span>
    ) : (
      <Link
        href={hrefFor(params, target)}
        className={buttonVariants({ variant: "secondary", size: "md" })}
      >
        {label}
      </Link>
    );
  return (
    <nav
      aria-label={t("pagination")}
      className="flex items-center gap-2 text-small"
    >
      {link(page - 1, t("previous"), page <= 1)}
      <span className="px-1 text-fg-muted">{t("pageOf", { page, pages })}</span>
      {link(page + 1, t("next"), page >= pages)}
    </nav>
  );
}
