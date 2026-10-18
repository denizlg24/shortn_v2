import { listTags, pageQrs, type QrView } from "@shortn/core";
import { can } from "@shortn/core/authz";
import { buttonVariants, cn } from "@shortn/ui";
import { LayoutGrid, List } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { BulkSelection } from "@/components/page/bulk-selection";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { Pagination } from "@/components/page/pagination";
import { QrFilters } from "@/components/qr/qr-filters";
import { QrImage } from "@/components/qr/qr-image";
import { printedOptions } from "@/components/qr/qr-options";
import { serviceContext } from "@/server/context";
import { qrName } from "@/server/qr-page";
import { createdBounds } from "@/components/page/created-range";
import { requestTime } from "@/server/time";
import { env } from "@/server/env";

const pageSize = 24;

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

const host = (qr: QrView) => qr.shortUrl.replace(/^https?:\/\//, "");

export async function generateMetadata() {
  const t = await getTranslations("qr.list");
  return { title: t("title") };
}

export default async function QrCodesPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/qr">) {
  const { workspace } = await params;
  const query = await searchParams;
  const t = await getTranslations("qr.list");
  const importText = await getTranslations("imports");
  const exportText = await getTranslations("qrExports"),
    selectionText = await getTranslations("page.selection");
  const exportsEnabled = env().QR_EXPORTS_ENABLED === "1";
  const format = await getFormatter();
  const ctx = await serviceContext(workspace);

  const search = one(query.q)?.slice(0, 200);
  const selectedTags = (
    Array.isArray(query.tag) ? query.tag : query.tag ? [query.tag] : []
  )
    .map((tag) => tag.slice(0, 48))
    .slice(0, 50);
  const createdParams = new URLSearchParams();
  for (const key of ["created", "from", "to"]) {
    const value = one(query[key]);
    if (value) createdParams.set(key, value);
  }
  const dateBounds = createdBounds(createdParams, requestTime());
  const view = one(query.view) === "list" ? "list" : "grid";
  const pageNumber = Math.max(1, Number(one(query.page)) || 1);

  const [tags, result] = await Promise.all([
    listTags(ctx),
    pageQrs(ctx, {
      search,
      tags: selectedTags.length ? selectedTags : undefined,
      ...dateBounds,
      page: pageNumber,
      limit: pageSize,
    }),
  ]);

  const canCreate = can(ctx.actor, "resource.create");
  const deletable = (qr: QrView) =>
    can(ctx.actor, "resource.delete", { createdBy: qr.createdBy ?? undefined });
  const anyDeletable = result.items.some(deletable);
  const filtered = Boolean(
    search || selectedTags.length || Object.keys(dateBounds).length,
  );
  const deleted = Number(one(query.deleted));
  const base = `/${workspace}/qr`;

  const viewHref = (next: "grid" | "list") => {
    const kept = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key === "view" || key === "deleted" || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value])
        kept.append(key, item);
    }
    if (next === "list") kept.set("view", "list");
    const string = kept.toString();
    return string ? `${base}?${string}` : base;
  };

  const checkbox = (qr: QrView, className?: string) =>
    exportsEnabled || deletable(qr) ? (
      <input
        type="checkbox"
        name="ids"
        value={qr.id}
        aria-label={t("selectRow", { name: qrName(qr) })}
        className={cn("size-4 accent-[var(--color-signal)]", className)}
      />
    ) : null;

  const scans = (qr: QrView) =>
    t("scans", { count: qr.scans, formatted: format.number(qr.scans) });

  return (
    <Page
      crumbs={[{ label: t("title") }]}
      title={t("title")}
      description={t("count", { count: result.total })}
      actions={
        <>
          <div
            role="group"
            aria-label={t("layout")}
            className="flex rounded-control border border-line-strong p-0.5"
          >
            {(["grid", "list"] as const).map((option) => {
              const Icon = option === "grid" ? LayoutGrid : List;
              return (
                <Link
                  key={option}
                  href={viewHref(option)}
                  aria-current={view === option ? "true" : undefined}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-small text-fg-muted hover:text-fg",
                    "aria-[current]:bg-bg-muted aria-[current]:font-medium aria-[current]:text-fg",
                    "focus-visible:outline-2 focus-visible:outline-signal",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {t(`layouts.${option}`)}
                </Link>
              );
            })}
          </div>
          {canCreate ? (
            <>
              {env().IMPORTS_ENABLED === "1" ? (
                <Link
                  href={`/${workspace}/imports/new?kind=qr`}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  {importText("entry")}
                </Link>
              ) : null}
              <Link
                href={`${base}/new`}
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                {t("new")}
              </Link>
            </>
          ) : null}
        </>
      }
    >
      {deleted > 0 ? (
        <Notice tone="success">{t("deleted", { count: deleted })}</Notice>
      ) : null}
      <QrFilters tags={tags.map((item) => item.name)} />

      {result.items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-body text-fg-muted">
            {filtered ? t("emptyFiltered") : t("empty")}
          </p>
          {!filtered && canCreate ? (
            <Link
              href={`${base}/new`}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "mt-4",
              )}
            >
              {t("new")}
            </Link>
          ) : null}
        </div>
      ) : (
        <BulkSelection
          key="qr-selection"
          action={`${base}/delete`}
          enabled={exportsEnabled || anyDeletable}
          allowed={exportsEnabled || can(ctx.actor, "resource.update")}
          {...(exportsEnabled
            ? {
                actions: [
                  {
                    href: `${base}/export`,
                    label: exportText("selectedAction"),
                    clear: false,
                  },
                  ...(can(ctx.actor, "resource.update")
                    ? [
                        {
                          href: `${base}/delete`,
                          label: selectionText("delete"),
                        },
                      ]
                    : []),
                ],
              }
            : {})}
          eligible={result.items
            .filter(
              (qr) =>
                exportsEnabled ||
                can(ctx.actor, "resource.delete", {
                  createdBy: qr.createdBy ?? undefined,
                }),
            )
            .map((qr) => qr.id)}
        >
          {view === "grid" ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] border-t border-l border-line">
              {result.items.map((qr) => (
                <li
                  key={qr.id}
                  className="relative flex min-w-0 flex-col gap-3 border-r border-b border-line px-4 pt-5 pb-3.5 hover:bg-bg-subtle has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-signal"
                >
                  <QrImage
                    options={printedOptions(qr.storedDesign, qr.shortUrl)}
                    size={120}
                    alt=""
                    lazy
                    className="mx-auto"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={`${base}/${qr.id}`}
                      className="truncate text-small font-medium outline-none after:absolute after:inset-0 after:content-['']"
                    >
                      {qrName(qr)}
                    </Link>
                    <p className="flex min-w-0 items-baseline justify-between gap-2 text-meta text-fg-muted">
                      <span className="min-w-0 truncate font-mono">
                        {qr.key}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {scans(qr)}
                      </span>
                    </p>
                  </div>
                  {checkbox(qr, "absolute top-3 left-3 z-10")}
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead className="border-b border-line text-left text-meta text-fg-muted">
                  <tr>
                    {exportsEnabled || anyDeletable ? (
                      <th scope="col" className="w-10 py-2 pr-2 font-medium">
                        <span className="sr-only">{t("columns.select")}</span>
                      </th>
                    ) : null}
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {t("columns.code")}
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-4 font-medium max-md:hidden"
                    >
                      {t("columns.link")}
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-4 font-medium max-lg:hidden"
                    >
                      {t("columns.destination")}
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-4 text-right font-medium"
                    >
                      {t("columns.scans")}
                    </th>
                    <th
                      scope="col"
                      className="py-2 text-right font-medium max-sm:hidden"
                    >
                      {t("columns.created")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.items.map((qr) => (
                    <tr key={qr.id} className="hover:bg-bg-subtle">
                      {exportsEnabled || anyDeletable ? (
                        <td className="py-2.5 pr-2">{checkbox(qr)}</td>
                      ) : null}
                      <td className="py-2.5 pr-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <QrImage
                            options={printedOptions(
                              qr.storedDesign,
                              qr.shortUrl,
                            )}
                            size={32}
                            alt=""
                            lazy
                          />
                          <div className="min-w-0 w-64 max-w-[calc(100vw-12rem)]">
                            <Link
                              href={`${base}/${qr.id}`}
                              className="line-clamp-2 break-words font-medium text-fg hover:underline"
                              title={qrName(qr)}
                            >
                              {qrName(qr)}
                            </Link>
                            {qr.tags.length ? (
                              <p className="truncate text-meta text-fg-muted">
                                {qr.tags.map((item) => item.name).join(", ")}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-fg-muted max-md:hidden">
                        {host(qr)}
                      </td>
                      <td className="max-w-80 truncate py-2.5 pr-4 text-fg-muted max-lg:hidden">
                        {qr.url}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                        {format.number(qr.scans)}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap text-fg-muted max-sm:hidden">
                        {format.dateTime(new Date(qr.createdAt), {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <Pagination
              page={result.page}
              pages={result.pages}
              params={query}
            />
          </div>
        </BulkSelection>
      )}
    </Page>
  );
}
