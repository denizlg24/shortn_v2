import { notFound } from "next/navigation";
import { ObjectId, type Document } from "mongodb";
import Link from "next/link";
import { collection, physicalNames } from "@shortn/db";
import { createPolar } from "@shortn/billing";
import { env } from "@/server/env";
import { loadEntitlements } from "@shortn/billing";
import { TimeSeriesChart } from "@shortn/ui";
import { adminCan, consoleActions, countUsage } from "@shortn/core";
import { DataTable } from "@/components/data-table";
import { PageHeader, PageBody, Facts, Section } from "@/components/page";
import { Pager } from "@/components/pager";
import { areas, display, fieldValue, jobCollections } from "@/server/areas";
import { detailTabs } from "@/server/detail";
import { db } from "@/server/db";
import { keysetPage, param } from "@/server/list";
import { requireAdmin } from "@/server/session";

export default async function Detail({
  params,
  searchParams,
}: PageProps<"/[area]/[id]">) {
  const { area, id } = await params;
  const config = areas[area];
  if (!config) notFound();
  const current = await requireAdmin();
  const database = await db();
  const search = await searchParams;
  const kind = param(search, "kind") ?? "imports";
  const name = area === "jobs" ? jobCollections[kind] : config.collection;
  if (!name) notFound();
  if (
    !ObjectId.isValid(id) &&
    !(area === "jobs" && kind === "billing" && /^[\w.:-]{1,200}$/.test(id))
  )
    notFound();
  const row = await database
    .collection<Document & { _id: ObjectId | string }>(name)
    .findOne({
      _id: area === "jobs" && kind === "billing" ? id : new ObjectId(id),
    });
  if (!row) notFound();
  const workspace =
    area === "workspaces"
      ? await collection(database, "workspaces").findOne({
          _id: new ObjectId(id),
        })
      : null;
  const entitlements = workspace
    ? await loadEntitlements(database, workspace)
    : null;
  const usage =
    workspace && entitlements
      ? await countUsage(database, workspace, entitlements.period)
      : null;
  const chart =
    area === "workspaces" || area === "links"
      ? await database
          .collection(
            area === "workspaces"
              ? physicalNames.workspace_daily
              : physicalNames.click_rollups,
          )
          .find(
            {
              [area === "workspaces" ? "workspaceId" : "linkId"]: new ObjectId(
                id,
              ),
              day: { $gte: new Date(new Date().getTime() - 90 * 86400000) },
            },
            { projection: { day: 1, clicks: 1, scans: 1 } },
          )
          .sort({ day: 1 })
          .limit(90)
          .toArray()
      : [];
  const base = `/${area}/${id}`;
  const suffix = area === "jobs" ? `?kind=${kind}` : "";
  const tabs = detailTabs(area, row);
  const tabId = param(search, "tab") ?? Object.keys(tabs)[0];
  const tab = tabId ? tabs[tabId] : undefined;
  const page = tab
    ? await keysetPage(database.collection(tab.collection), tab.filter, {
        after: param(search, "after"),
        before: param(search, "before"),
        projection: Object.fromEntries(tab.fields.map(([key]) => [key, 1])),
      })
    : null;
  let liveOrders: {
    id: string;
    number: string | null;
    status: string;
    amount: number;
    currency: string;
    date: string;
  }[] = [];
  let orderPages = 0,
    liveError = false;
  const requestedOrderPage = Number(param(search, "ordersPage"));
  const orderPage =
    Number.isSafeInteger(requestedOrderPage) && requestedOrderPage > 0
      ? Math.min(100000, requestedOrderPage)
      : 1;
  if (workspace && tabId === "billing" && env().POLAR_ACCESS_TOKEN) {
    const mirrors = await collection(database, "subscriptions")
      .find(
        { workspaceId: workspace._id },
        { projection: { polarSubscriptionId: 1 } },
      )
      .limit(1000)
      .toArray();
    const ids = mirrors.map((m) => m.polarSubscriptionId);
    if (ids.length)
      try {
        const polar = createPolar({
          accessToken: env().POLAR_ACCESS_TOKEN!,
          server: env().POLAR_ENVIRONMENT,
        });
        const response = await polar.orders.list({
          subscriptionId: ids,
          page: orderPage,
          limit: 20,
          sorting: ["-created_at"],
        });
        liveOrders = response.result.items
          .filter((o) => o.subscriptionId && ids.includes(o.subscriptionId))
          .map((o) => ({
            id: o.id,
            number: o.invoiceNumber,
            status: o.status,
            amount: o.totalAmount,
            currency: o.currency,
            date: o.createdAt.toISOString(),
          }));
        orderPages = response.result.pagination.maxPage;
      } catch {
        liveError = true;
      }
  }
  return (
    <>
      <PageHeader
        title={display(
          row.email ?? row.name ?? row.key ?? row.hostname ?? row._id,
        )}
        crumbs={[{ label: config.title, href: `/${area}` }]}
      />
      <PageBody>
        <Facts
          items={[
            ["ID", id],
            ...config.fields.map(([key, label]): [string, string] => [
              label,
              display(fieldValue(row, key)),
            ]),
          ]}
        />
        {workspace && entitlements && usage ? (
          <Section title="Effective entitlements">
            <Facts
              items={[
                ["Plan", entitlements.plan],
                ["Source", entitlements.sources.plan],
                [
                  "Override expires",
                  display(entitlements.sources.overrideExpiresAt),
                ],
                ...(["links", "qrCodes", "bioPages"] as const).map(
                  (key): [string, string] => [
                    key,
                    `${usage[key]} / ${entitlements.limits[key] ?? "Unlimited"}`,
                  ],
                ),
                [
                  "API requests per minute",
                  String(entitlements.limits.apiPerMinute ?? "Unlimited"),
                ],
                ["Seats", String(entitlements.limits.seats ?? "Unlimited")],
              ]}
            />
          </Section>
        ) : null}
        {chart.length ? (
          <Section title="Clicks and scans · last 90 days">
            <TimeSeriesChart
              data={chart.map((point) => ({
                date: point.day.toISOString(),
                value: Number(point.clicks ?? 0),
                scans: Number(point.scans ?? 0),
              }))}
              seriesLabel="Clicks and scans"
              series={[
                { key: "value", label: "Clicks" },
                { key: "scans", label: "Scans" },
              ]}
            />
          </Section>
        ) : null}
        {area === "feedback" ? (
          <nav
            aria-label="Related"
            className="flex flex-wrap gap-3 text-small text-signal"
          >
            {typeof row.userId === "string" ? (
              <Link href={`/users/${row.userId}`}>Open user</Link>
            ) : null}
            {row.workspaceId ? (
              <Link href={`/workspaces/${String(row.workspaceId)}`}>
                Open workspace
              </Link>
            ) : null}
          </nav>
        ) : null}
        {area === "contacts" && row.email ? (
          <a
            className="text-small text-signal"
            href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`[${id}] ${row.subject ?? "Support request"}`)}`}
          >
            Reply by email
          </a>
        ) : null}
        <nav
          aria-label="Actions"
          className="flex flex-wrap gap-3 text-small text-signal"
        >
          {config.actions
            ?.filter((op) => {
              if (
                area === "jobs" &&
                ["qr", "zips"].includes(kind) &&
                op === "cancel"
              )
                return false;
              const action = consoleActions[`${area}/${op}`];
              return action && adminCan({ role: current.admin.role }, action);
            })
            .map((op) => (
              <Link key={op} href={`${base}/${op}${suffix}`}>
                {op.split("-").join(" ")}
              </Link>
            ))}
        </nav>
        {area === "users" && row.deletion ? (
          <Section title="Account deletion">
            <Facts
              items={[
                ["State", display(row.deletion.state)],
                ["Purge after", display(row.deletion.purgeAfter)],
              ]}
            />
          </Section>
        ) : null}
        {area === "links" ? (
          <Section title="Safety and moderation">
            <Facts
              items={[
                ["Scan verdict", display(row.safetyStatus)],
                ["Last scanned", display(row.safety?.lastScannedAt)],
                ["Category", display(row.moderation?.category)],
                ["Internal note", display(row.moderation?.internalNote)],
                ["Public note", display(row.moderation?.publicNote)],
              ]}
            />
          </Section>
        ) : null}
        {Object.keys(tabs).length ? (
          <nav
            aria-label="Detail sections"
            className="flex flex-wrap gap-x-4 gap-y-2 border-b border-line text-small"
          >
            {Object.entries(tabs).map(([key, value]) => (
              <Link
                key={key}
                href={`${base}?tab=${key}`}
                aria-current={key === tabId ? "page" : undefined}
                className={
                  key === tabId
                    ? "border-b-2 border-fg pb-2 font-medium"
                    : "pb-2 text-fg-muted hover:text-fg"
                }
              >
                {value.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {tab && page ? (
          <Section title={tab.label}>
            <DataTable
              columns={tab.fields.map(([id, header]) => ({ id, header }))}
              rows={page.rows.map((item) => ({
                id: String(item._id),
                ...(area === "links" && tabId === "reports"
                  ? { href: `/reports/${item._id}` }
                  : {}),
                cells: Object.fromEntries(
                  tab.fields.map(([key]) => [
                    key,
                    <span
                      key={key}
                      className="block max-w-96 truncate"
                      title={display(fieldValue(item, key))}
                    >
                      {display(fieldValue(item, key))}
                    </span>,
                  ]),
                ),
              }))}
            />
            <Pager search={search} next={page.next} prev={page.prev} />
          </Section>
        ) : null}
        {workspace && tabId === "billing" ? (
          <Section title="Polar orders · live">
            {liveError ? (
              <p role="status" className="text-small text-fg-muted">
                Polar could not be reached. Refresh to try again; the
                subscription mirror is shown above.
              </p>
            ) : !env().POLAR_ACCESS_TOKEN ? (
              <p className="text-small text-fg-muted">
                Live order history requires the console's Polar connection.
              </p>
            ) : (
              <>
                <DataTable
                  columns={[
                    { id: "number", header: "Invoice" },
                    { id: "date", header: "Created" },
                    { id: "status", header: "Status" },
                    { id: "amount", header: "Amount (minor units)" },
                    { id: "id", header: "Order ID" },
                  ]}
                  rows={liveOrders.map((o) => ({
                    id: o.id,
                    cells: {
                      number: o.number ?? "—",
                      date: o.date,
                      status: o.status,
                      amount: `${o.amount} ${o.currency.toUpperCase()}`,
                      id: o.id,
                    },
                  }))}
                />
                <nav
                  aria-label="Order pages"
                  className="flex gap-4 text-small text-signal"
                >
                  {orderPage > 1 ? (
                    <Link
                      href={`${base}?tab=billing&ordersPage=${orderPage - 1}`}
                    >
                      Previous orders
                    </Link>
                  ) : null}
                  {orderPage < orderPages ? (
                    <Link
                      href={`${base}?tab=billing&ordersPage=${orderPage + 1}`}
                    >
                      Next orders
                    </Link>
                  ) : null}
                </nav>
              </>
            )}
          </Section>
        ) : null}
      </PageBody>
    </>
  );
}
