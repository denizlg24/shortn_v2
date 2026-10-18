import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { countSelectedQrs, listTags, pageQrs } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { Page, Section } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { Pagination } from "@/components/page/pagination";
import { QrFilters } from "@/components/qr/qr-filters";
import { QrExportForm } from "@/components/qr/export-form";
import { createdBounds } from "@/components/page/created-range";
import { decodeSelection, encodeSelection } from "@/lib/bulk-selection";
import { serviceContext } from "@/server/context";
import {
  qrExportStore,
  readQrSelection,
  saveQrSelection,
} from "@/server/qr-exports";
import { requestTime } from "@/server/time";
import { qrName } from "@/server/qr-page";

export async function generateMetadata() {
  return { title: (await getTranslations("qrExports"))("bulkTitle") };
}
export default async function ExportSelectedQrsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/qr/export">) {
  const { workspace } = await params,
    query = await searchParams;
  const [ctx, t, formatter] = await Promise.all([
    serviceContext(workspace),
    getTranslations("qrExports"),
    getFormatter(),
  ]);
  const base = `/${workspace}/qr`,
    enabled = Boolean(qrExportStore());
  const incoming = decodeSelection(query.selection);
  if (enabled && incoming.length) {
    const ref = await saveQrSelection(ctx, incoming);
    redirect(`${base}/export?selectionRef=${ref}`);
  }
  const ids = enabled ? await readQrSelection(ctx, query.selectionRef) : [];
  const ref = typeof query.selectionRef === "string" ? query.selectionRef : "";
  const tagsSelected = (
    Array.isArray(query.tag) ? query.tag : query.tag ? [query.tag] : []
  )
    .map((tag) => tag.slice(0, 48))
    .slice(0, 50);
  const dates = new URLSearchParams();
  for (const key of ["created", "from", "to"])
    if (typeof query[key] === "string") dates.set(key, query[key]);
  const [count, tags, result] = await Promise.all([
    ids.length ? countSelectedQrs(ctx, ids) : 0,
    ids.length ? listTags(ctx) : [],
    ids.length
      ? pageQrs(ctx, {
          ids,
          search:
            typeof query.q === "string" ? query.q.slice(0, 200) : undefined,
          tags: tagsSelected,
          ...createdBounds(dates, requestTime()),
          page: Math.max(1, Number(query.page) || 1),
          limit: 25,
        })
      : null,
  ]);
  const groups = new Map<string, NonNullable<typeof result>["items"]>();
  for (const qr of result?.items ?? []) {
    const date = formatter.dateTime(new Date(qr.createdAt), {
      dateStyle: "medium",
    });
    groups.set(date, [...(groups.get(date) ?? []), qr]);
  }
  return (
    <Page
      crumbs={[
        { label: (await getTranslations("qr.list"))("title"), href: base },
        { label: t("bulkTitle") },
      ]}
      title={t("bulkTitle")}
      description={t("selected", { count: ids.length })}
      width="form"
    >
      {!enabled || !ids.length ? (
        <>
          <Notice tone="warning">
            {t(!enabled ? "disabled" : "errors.unavailable")}
          </Notice>
          <Link
            href={base}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t("back")}
          </Link>
        </>
      ) : (
        <>
          <Section title={t("output")}>
            <QrExportForm
              workspace={workspace}
              selection={encodeSelection(ids)}
              count={ids.length}
              bundle
              cancelHref={base}
              {...(count !== ids.length ? { error: "not_found" } : {})}
            />
          </Section>
          <Section
            title={t("reviewTitle")}
            description={t("reviewHint", { count: ids.length })}
          >
            <QrFilters
              tags={tags.map((tag) => tag.name)}
              preserve={{ selectionRef: ref }}
            />
            <p className="mb-3 text-small text-fg-muted">
              {t("matching", { count: result?.total ?? 0, total: ids.length })}
            </p>
            {result?.items.length ? (
              [...groups].map(([date, rows]) => (
                <div key={date} className="mb-5 last:mb-0">
                  <h3 className="mb-2 text-small font-medium">{date}</h3>
                  <ul className="divide-y divide-line border-y border-line">
                    {rows.map((qr) => (
                      <li
                        key={qr.id}
                        className="flex min-w-0 flex-col gap-1 py-3"
                      >
                        <Link
                          href={`${base}/${qr.id}`}
                          title={qrName(qr)}
                          className="truncate text-small font-medium hover:underline"
                        >
                          {qrName(qr)}
                        </Link>
                        <p className="truncate font-mono text-meta text-fg-muted">
                          {qr.shortUrl.replace(/^https?:\/\//, "")}
                        </p>
                        {qr.tags.length ? (
                          <p className="line-clamp-2 text-meta text-fg-muted">
                            {qr.tags.map((tag) => tag.name).join(" · ")}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="py-6 text-small text-fg-muted">
                {t("emptyFiltered")}
              </p>
            )}
            {result ? (
              <div className="mt-4 flex flex-wrap justify-end">
                <Pagination
                  page={result.page}
                  pages={result.pages}
                  params={query}
                />
              </div>
            ) : null}
          </Section>
        </>
      )}
    </Page>
  );
}
