import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { can } from "@shortn/core/authz";
import { buttonVariants } from "@shortn/ui";
import { Page } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { Pagination } from "@/components/page/pagination";
import { ImportFilters } from "@/components/imports/filters";
import { listImportsAction } from "@/server/actions/imports";
import { serviceContext } from "@/server/context";
import { importStore } from "@/server/imports";

export async function generateMetadata() {
  return { title: (await getTranslations("imports"))("title") };
}
export default async function ImportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace } = await params,
    query = await searchParams;
  const [ctx, t, format] = await Promise.all([
    serviceContext(workspace),
    getTranslations("imports"),
    getFormatter(),
  ]);
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const result = await listImportsAction(workspace, {
    page: Math.max(1, Math.floor(Number(one(query.page)) || 1)),
    ...(one(query.kind) ? { kind: one(query.kind) } : {}),
    ...(one(query.state) ? { state: one(query.state) } : {}),
  });
  return (
    <Page
      crumbs={[{ label: t("title") }]}
      title={t("history")}
      description={
        result.data ? t("count", { count: result.data.total }) : undefined
      }
      actions={
        importStore() && can(ctx.actor, "resource.create") ? (
          <Link
            href={`/${workspace}/imports/new`}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            {t("newAction")}
          </Link>
        ) : undefined
      }
    >
      <div className="mb-5">
        <Link
          href={`/${workspace}/links`}
          className="text-small text-signal hover:underline"
        >
          {t("back")}
        </Link>
      </div>
      {result.data ? (
        <>
          <ImportFilters workspace={workspace} />
          <ol className="mb-6 divide-y divide-line border-y border-line">
            {result.data.items.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/${workspace}/imports/${job.id}`}
                    className="text-small font-medium text-signal hover:underline"
                  >
                    {t(job.kind)} ·{" "}
                    {format.dateTime(new Date(job.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Link>
                  <p className="mt-1 text-meta text-fg-muted">
                    {t("outcome", {
                      done: format.number(job.done),
                      total: format.number(job.valid),
                    })}
                  </p>
                </div>
                <span className="text-small text-fg-muted">
                  {t(`states.${job.state}`)}
                </span>
              </li>
            ))}
          </ol>
          {!result.data.items.length ? (
            <p className="py-10 text-small text-fg-muted">{t("empty")}</p>
          ) : null}
          <Pagination
            page={result.data.page}
            pages={Math.ceil(result.data.total / result.data.pageSize)}
            params={query}
          />
        </>
      ) : (
        <Notice tone="warning">
          {t(
            result.error === "invalid_input"
              ? "errors.invalid_input"
              : "disabled",
          )}
        </Notice>
      )}
    </Page>
  );
}
