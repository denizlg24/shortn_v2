import { collection } from "@shortn/db";
import { TimeSeriesChart } from "@shortn/ui";
import Link from "next/link";
import { PageHeader, PageBody, Section, Facts } from "@/components/page";
import { Filters, FilterSelect } from "@/components/filters";
const fmtCount = (n: number) => n.toLocaleString("en");
import { db } from "@/server/db";
import { choice } from "@/server/list";
import { requireAdmin } from "@/server/session";

export default async function Overview({ searchParams }: PageProps<"/">) {
  await requireAdmin();
  const search = await searchParams;
  const days = Number(
    choice(search, "days", ["7", "30", "90", "365"] as const) ?? "30",
  );
  const since = new Date(new Date().getTime() - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const database = await db();
  const daily = await collection(database, "platform_daily")
    .find({ _id: { $gte: since } })
    .sort({ _id: 1 })
    .limit(400)
    .toArray();
  const sum = (get: (d: (typeof daily)[number]) => number) =>
    daily.reduce((n, d) => n + get(d), 0);
  const last = daily.at(-1);
  const series = (get: (d: (typeof daily)[number]) => number) =>
    daily.map((d) => ({ date: `${d._id}T00:00:00.000Z`, value: get(d) }));
  return (
    <>
      <PageHeader title="Overview" />
      <PageBody>
        <Filters>
          <FilterSelect
            name="days"
            label="Range"
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              { value: "365", label: "365 days" },
            ]}
          />
        </Filters>
        {!daily.length ? (
          <p className="text-small text-fg-muted">
            Metrics are being prepared. The worker refreshes today and yesterday
            every five minutes and fills one historical day per tick.
          </p>
        ) : (
          <>
            <Facts
              items={[
                ["Signups", fmtCount(sum((d) => d.users?.signups ?? 0))],
                ["Links created", fmtCount(sum((d) => d.links?.created ?? 0))],
                ["Human clicks", fmtCount(sum((d) => d.clicks?.human ?? 0))],
                ["QR scans", fmtCount(sum((d) => d.clicks?.scans ?? 0))],
                ["Bio views", fmtCount(sum((d) => d.bioViews ?? 0))],
                [
                  "List-price MRR (latest snapshot)",
                  last?.billing
                    ? `$${last.billing.mrrListUsd.toFixed(2)}`
                    : "Not recorded",
                ],
              ]}
            />
            <Section title="Human clicks">
              <TimeSeriesChart
                data={series((d) => d.clicks?.human ?? 0)}
                seriesLabel="Human clicks"
              />
            </Section>
            <Section title="QR scans">
              <TimeSeriesChart
                data={series((d) => d.clicks?.scans ?? 0)}
                seriesLabel="QR scans"
              />
            </Section>
            <Section title="Signups">
              <TimeSeriesChart
                data={series((d) => d.users?.signups ?? 0)}
                seriesLabel="Signups"
              />
            </Section>
            <Section title="Moderation">
              <Facts
                items={[
                  [
                    "Reports opened",
                    fmtCount(sum((d) => d.reports?.opened ?? 0)),
                  ],
                  [
                    "Takedowns",
                    fmtCount(sum((d) => d.moderation?.takedowns ?? 0)),
                  ],
                  [
                    "Workspace suspensions",
                    fmtCount(sum((d) => d.moderation?.suspensions ?? 0)),
                  ],
                  ["Bans", fmtCount(sum((d) => d.moderation?.bans ?? 0))],
                ]}
              />
            </Section>
            <p className="text-meta text-fg-muted">
              {daily.length} recorded days. Updated{" "}
              {last?.computedAt.toISOString()}. Missing days are backfilled by
              the worker. MRR uses catalog prices; custom enterprise pricing is
              excluded.{" "}
              <Link href="/billing" className="text-signal underline">
                Inspect billing
              </Link>
            </p>
          </>
        )}
        <nav
          aria-label="Operations"
          className="flex flex-wrap gap-4 text-small text-signal"
        >
          <Link href="/reports">Reports queue</Link>
          <Link href="/jobs">Worker and queues</Link>
          <Link href="/audit">Staff audit</Link>
        </nav>
      </PageBody>
    </>
  );
}
