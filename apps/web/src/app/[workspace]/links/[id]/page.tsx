import { can } from "@shortn/core";
import { minimumPlanFor } from "@shortn/billing";
import { physicalNames } from "@shortn/db";
import { ObjectId } from "mongodb";
import { buttonVariants, TimeSeriesChart } from "@shortn/ui";
import { notFound } from "next/navigation";
import { analyticsAction } from "@/server/actions/analytics";
import { PlanGate } from "@/components/plan-gate";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { CopyButton } from "@/components/page/copy-button";
import { ShareButton } from "@/components/page/share-button";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import { linkTabs, loadLink } from "@/server/link-page";
import { lastDays } from "@/server/time";

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/links/[id]">) {
  const { workspace, id } = await params;
  const { link } = await loadLink(workspace, id);
  return { title: `${link.domain}/${link.key}` };
}

export default async function LinkOverviewPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/links/[id]">) {
  const { workspace, id } = await params;
  const { created, saved } = await searchParams;
  const t = await getTranslations("linkPages");
  const safetyText = await getTranslations("links.safety");
  const format = await getFormatter();
  const { ctx, link } = await loadLink(workspace, id);
  const shortUrl = `https://${link.domain}/${link.key}`;
  const base = `/${workspace}/links/${id}`;
  const creator =
    link.createdBy && /^[a-f0-9]{24}$/i.test(link.createdBy)
      ? await ctx.db
          .collection(physicalNames.user)
          .findOne(
            { _id: new ObjectId(link.createdBy) },
            { projection: { name: 1, username: 1 } },
          )
      : null;
  const creatorName =
    typeof creator?.name === "string" && creator.name.trim()
      ? creator.name
      : typeof creator?.username === "string" && creator.username.trim()
        ? creator.username
        : t("overview.unknownCreator");
  const safetyStatus =
    (["pending", "safe", "suspicious", "malicious", "blocked"] as const).find(
      (status) => status === link.safety.status,
    ) ?? "unknown";

  const range = lastDays(30);
  const analytics = await analyticsAction(workspace, {
    scope: { type: "link", id },
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    timezone: "UTC",
    interval: "day",
    dimensions: ["country", "referrer"],
    limit: 5,
    compare: false,
  });
  if (!analytics.ok) notFound();
  const data = analytics.data;
  const stats = data.totals;
  const countries = data.breakdowns.country ?? [];
  const referrers = data.breakdowns.referrer ?? [];
  const countryName = new Intl.DisplayNames([await getLocale()], {
    type: "region",
  });
  const top = {
    countries: countries.map((row) => ({
      label:
        row.value === "unknown"
          ? "—"
          : (countryName.of(row.value) ?? row.value),
      value: row.clicks + row.scans,
    })),
    referrers: referrers.map((row) => ({
      label: row.value,
      value: row.clicks + row.scans,
    })),
  };

  const detail = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[10rem_1fr] gap-4 py-2.5 max-sm:grid-cols-1 max-sm:gap-1">
      <dt className="text-small text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-small break-words">{value}</dd>
    </div>
  );

  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: `${link.domain}/${link.key}` },
      ]}
      title={`${link.domain}/${link.key}`}
      description={link.title || undefined}
      actions={
        <>
          <CopyButton
            value={shortUrl}
            label={t("overview.copy")}
            copiedLabel={t("overview.copied")}
          />
          <ShareButton url={shortUrl} title={link.title || undefined} />
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost", size: "md" })}
          >
            {t("overview.open")}
          </a>
        </>
      }
      tabs={linkTabs(workspace, id, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      {created ? <Notice tone="success">{t("overview.created")}</Notice> : null}
      {saved ? <Notice tone="success">{t("overview.saved")}</Notice> : null}
      {link.safety.disabled || safetyStatus === "blocked" ? (
        <Notice tone="warning">{t("overview.disabledNotice")}</Notice>
      ) : null}

      <Section
        title={t("overview.last30")}
        aside={
          <Link
            href={`${base}/analytics`}
            className="text-small text-signal hover:underline"
          >
            {t("overview.seeAll")}
          </Link>
        }
      >
        <dl className="grid grid-cols-2 gap-px overflow-hidden border-y border-line sm:grid-cols-4">
          {(
            [
              [t("overview.clicks"), stats.clicks],
              [t("overview.scans"), stats.scans],
              [t("overview.visitors"), stats.uniques],
              [t("overview.allTime"), link.clicks],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="py-3 pr-4">
              <dt className="text-meta text-fg-muted">{label}</dt>
              <dd className="mt-1 font-mono text-section tabular-nums">
                {format.number(value)}
              </dd>
            </div>
          ))}
        </dl>
        {data.range.clampedFrom ? (
          <p className="mt-3 text-small text-fg-muted">
            {t("overview.historyLimited", {
              date: format.dateTime(new Date(data.range.clampedFrom), {
                dateStyle: "medium",
              }),
            })}
          </p>
        ) : null}
        <div className="mt-5 min-w-0">
          <h3 className="mb-3 text-small font-medium">
            {t("overview.activity")}
          </h3>
          {stats.clicks + stats.scans ? (
            <TimeSeriesChart
              data={data.series.map((point) => ({
                date: point.t,
                value: point.clicks + point.scans,
              }))}
              seriesLabel={t("overview.activity")}
              interval="day"
              height={220}
            />
          ) : (
            <p className="grid h-40 place-items-center text-small text-fg-muted">
              {t("overview.noActivity")}
            </p>
          )}
        </div>
        {data.gated.length ? (
          <div className="mt-5">
            <PlanGate
              feature="analyticsBreakdowns"
              plan={minimumPlanFor("analyticsBreakdowns")}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <TopList
              title={t("overview.topCountries")}
              rows={top.countries}
              empty={t("overview.noData")}
              format={format.number}
            />
            <TopList
              title={t("overview.topReferrers")}
              rows={top.referrers}
              empty={t("overview.noData")}
              format={format.number}
            />
          </div>
        )}
      </Section>

      <Section title={t("overview.details")}>
        <dl className="divide-y divide-line border-y border-line">
          {detail(
            t("overview.destination"),
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="text-signal hover:underline"
            >
              {link.url}
            </a>,
          )}
          {detail(t("overview.title"), link.title || t("overview.none"))}
          {detail(
            t("overview.description"),
            link.description || t("overview.none"),
          )}
          {detail(
            t("overview.tags"),
            link.tags.length
              ? link.tags.map((tag) => tag.name).join(", ")
              : t("overview.none"),
          )}
          {detail(
            t("overview.protection"),
            link.password
              ? link.password.hint
                ? t("overview.protectedHint", { hint: link.password.hint })
                : t("overview.protected")
              : t("overview.unprotected"),
          )}
          {detail(
            t("overview.safety"),
            <div className="flex flex-col gap-1">
              <span>{safetyText(safetyStatus)}</span>
              {link.safety.disabled ? (
                <span className="text-danger">{safetyText("disabled")}</span>
              ) : null}
              {link.safety.interstitial &&
              !link.safety.disabled &&
              safetyStatus !== "blocked" ? (
                <span className="text-fg-muted">
                  {t("overview.safetyPage")}
                </span>
              ) : null}
            </div>,
          )}
          {detail(t("overview.createdBy"), creatorName)}
          {detail(
            t("overview.createdAt"),
            format.dateTime(new Date(link.createdAt), {
              dateStyle: "long",
              timeStyle: "short",
            }),
          )}
        </dl>
      </Section>

      {can(ctx.actor, "resource.delete", {
        createdBy: link.createdBy ?? undefined,
      }) ? (
        <Section title={t("overview.delete")}>
          <Link
            href={`${base}/delete`}
            className={buttonVariants({ variant: "dangerGhost", size: "md" })}
          >
            {t("overview.delete")}
          </Link>
        </Section>
      ) : null}
    </Page>
  );
}

function TopList({
  title,
  rows,
  empty,
  format,
}: {
  title: string;
  rows: { label: string; value: number }[];
  empty: string;
  format: (value: number) => string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-small font-medium">{title}</h3>
      {rows.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex justify-between py-2 text-small"
            >
              <span className="truncate">{row.label}</span>
              <span className="font-mono text-fg-muted tabular-nums">
                {format(row.value)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-fg-muted">{empty}</p>
      )}
    </div>
  );
}
