import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  LinkExportError,
  resolveAnalyticsExport,
  queryAnalytics,
  getCampaign,
} from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { Page } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { AnalyticsExportForm } from "@/components/analytics/export-form";
import { serviceContext } from "@/server/context";
import { linkExportStore } from "@/server/link-exports";
import { analyticsExportReview } from "@/server/analytics-export-review";
import { linkExportErrorKey } from "@/lib/link-export";
import type { LinkListQuery } from "@/server/link-list-query";

export async function generateMetadata() {
  return { title: (await getTranslations("analyticsExports"))("title") };
}
export default async function AnalyticsExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<LinkListQuery>;
}) {
  const { workspace } = await params,
    search = await searchParams;
  const [ctx, t, analytics, formatter] = await Promise.all([
    serviceContext(workspace),
    getTranslations("analyticsExports"),
    getTranslations("analytics"),
    getFormatter(),
  ]);
  const { input, back } = analyticsExportReview(search, workspace);
  let review: {
      from: Date;
      to: Date;
      count: number;
      scope: string;
      filters: [string, string][];
    } | null = null,
    error = input ? "unavailable" : "invalid_export";
  if (input && linkExportStore())
    try {
      const [resolved, result, campaign] = await Promise.all([
        resolveAnalyticsExport(ctx, input),
        queryAnalytics(ctx, {
          ...input,
          dimensions: [],
          series: false,
          compare: false,
        }),
        input.scope.type === "campaign"
          ? getCampaign(ctx, input.scope.id)
          : Promise.resolve(null),
      ]);
      if (!result.ok) throw new LinkExportError("forbidden");
      review = {
        from: resolved.range.from,
        to: resolved.range.to,
        count: result.value.totals.clicks + result.value.totals.scans,
        scope:
          campaign?.title ??
          (input.scope.type === "tag"
            ? input.scope.name
            : t(`scopes.${input.scope.type}`)),
        filters: Object.entries(input.filters).map(([key, value]) => [
          t(`dimensions.${key as import("@shortn/core").Dimension}`),
          key === "link"
            ? result.value.linkLabels[value]
              ? `/${result.value.linkLabels[value]}`
              : t("scopes.link")
            : key === "kind"
              ? analytics(value === "scan" ? "kinds.scan" : "kinds.click")
              : value,
        ]),
      };
    } catch (value) {
      error = value instanceof LinkExportError ? value.code : "failed";
    }
  return (
    <Page
      crumbs={[
        { label: analytics("title"), href: `/${workspace}/analytics` },
        { label: t("title") },
      ]}
      title={t("title")}
      description={t("description")}
      width="form"
      actions={
        <Link
          href={`/${workspace}/analytics/exports`}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("history")}
        </Link>
      }
    >
      {review && input ? (
        <>
          <h2 className="text-body font-semibold">{t("review")}</h2>
          <p className="mt-3 text-small font-medium tabular-nums">
            {t("scope", { count: review.count })}
          </p>
          <p className="mt-3 text-small text-fg-muted">{t("scopeHelp")}</p>
          <dl className="my-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 border-y border-line py-4 text-small">
            <dt className="text-fg-muted">{t("scopeLabel")}</dt>
            <dd className="break-words">{review.scope}</dd>
            <dt className="text-fg-muted">{t("window")}</dt>
            <dd>
              {review.from < review.to
                ? `${formatter.dateTime(review.from, { dateStyle: "medium", timeStyle: "short", timeZone: input.timezone })} – ${formatter.dateTime(review.to, { dateStyle: "medium", timeStyle: "short", timeZone: input.timezone })}`
                : t("noWindow")}
            </dd>
            <dt className="text-fg-muted">{t("timezone")}</dt>
            <dd className="break-words">{input.timezone}</dd>
            {review.filters.map(([label, value]) => (
              <div
                key={label}
                className="col-span-2 grid grid-cols-subgrid gap-x-5"
              >
                <dt className="text-fg-muted">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mb-5 text-small text-fg-muted">{t("retention")}</p>
          <AnalyticsExportForm
            key={JSON.stringify(input)}
            workspace={workspace}
            query={{
              ...input,
              ...(review.from < review.to
                ? {
                    from: review.from.toISOString(),
                    to: review.to.toISOString(),
                  }
                : {}),
            }}
            windowEmpty={review.from >= review.to}
            count={review.count}
            back={back}
          />
        </>
      ) : (
        <>
          <Notice tone="warning">{t(linkExportErrorKey(error))}</Notice>
          <div className="mt-5 flex flex-wrap gap-3">
            {error === "feature_required" ? (
              <Link
                href={`/${workspace}/settings/billing`}
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                {t("plan")}
              </Link>
            ) : null}
            <Link
              href={back}
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              {t("back")}
            </Link>
          </div>
        </>
      )}
    </Page>
  );
}
