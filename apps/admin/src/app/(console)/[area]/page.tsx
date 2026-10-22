import { AutoRefresh } from "@/components/auto-refresh";
import { queueSummary } from "@/server/queue-summary";
import { durableRedis } from "@/server/redis";
import { notFound } from "next/navigation";
import { destinationHostRev, physicalNames } from "@shortn/db";
import { ObjectId, type Document } from "mongodb";
import { DataTable } from "@/components/data-table";
import { Filters, FilterSearch, FilterSelect } from "@/components/filters";
import { PageHeader, PageBody, Section } from "@/components/page";
import { Pager } from "@/components/pager";
import {
  areas,
  areaViews,
  areaFor,
  display,
  fieldValue,
  jobCollections,
} from "@/server/areas";
import { db } from "@/server/db";
import {
  byIds,
  keysetPage,
  boundedCount,
  param,
  prefixRegex,
} from "@/server/list";
import { requireAdmin } from "@/server/session";
import Link from "next/link";

export default async function AreaPage({
  params,
  searchParams,
}: PageProps<"/[area]">) {
  const { area } = await params;
  const search = await searchParams;
  const view = param(search, "view");
  const config = areaFor(area, view);
  if (!config || area === "users") notFound();
  const current = await requireAdmin();
  const database = await db();
  const kind = param(search, "kind") ?? "imports";
  const collectionName =
    area === "jobs" ? jobCollections[kind] : config.collection;
  if (!collectionName) notFound();
  const match: Document = {
    ...("match" in config ? (config.match as Document) : {}),
  };
  if (area === "links" && param(search, "autoBlocked") === "yes") {
    match.disabledReason = "auto:report-threshold";
    match.moderation = { $exists: false };
  }
  const q = param(search, "q");
  if (q) {
    if (ObjectId.isValid(q)) match._id = new ObjectId(q);
    else if (area === "links" && q.includes("://")) {
      try {
        const url = new URL(q);
        match.domain = url.hostname.toLowerCase();
        match.key = decodeURIComponent(url.pathname.slice(1));
      } catch {
        match._id = { $in: [] };
      }
    } else if (config.search.length)
      match.$or = config.search.map((key) => ({
        [key]: prefixRegex(q.toLowerCase()),
      }));
    else match._id = { $in: [] };
  }
  for (const facet of config.facets ?? []) {
    const value = param(search, facet.name);
    if (value && facet.values.includes(value)) {
      if (
        (area === "contacts" &&
          facet.name === "triage.status" &&
          value === "new") ||
        (area === "audit" && facet.name === "status" && value === "succeeded")
      )
        match.$and = [
          ...(match.$and ?? []),
          {
            $or: [
              { [facet.name]: value },
              { [facet.name]: { $exists: false } },
            ],
          },
        ];
      else match[facet.name] = value;
    }
  }
  const host = param(search, "host");
  if (area === "links" && host) {
    const reversed = destinationHostRev(`https://${host}`);
    if (!reversed) match._id = { $in: [] };
    else
      match.destHostRev =
        param(search, "subdomains") === "yes"
          ? new RegExp(
              `^${reversed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\.|$)`,
            )
          : reversed;
  }
  const workspace = param(search, "workspace");
  let workspaceId: ObjectId | undefined;
  if (workspace) {
    workspaceId = ObjectId.isValid(workspace)
      ? new ObjectId(workspace)
      : (
          await database
            .collection(areas.workspaces!.collection)
            .findOne({ slug: workspace }, { projection: { _id: 1 } })
        )?._id;
    if (workspaceId) match.workspaceId = workspaceId;
    else match._id = { $in: [] };
  }
  const tagSearch = param(search, "tagQ") ?? "";
  const tags =
    area === "links" && workspaceId
      ? await database
          .collection(physicalNames.tags)
          .find(
            {
              workspaceId,
              ...(tagSearch
                ? { nameLower: prefixRegex(tagSearch.toLowerCase()) }
                : {}),
            },
            { projection: { name: 1, nameLower: 1, tagName: 1 } },
          )
          .sort({ nameLower: 1 })
          .limit(50)
          .toArray()
      : [];
  const tag = param(search, "tag");
  if (area === "links" && tag) {
    if (workspaceId && ObjectId.isValid(tag)) match.tagIds = new ObjectId(tag);
    else match._id = { $in: [] };
  }

  const [page, count] = await Promise.all([
    keysetPage(database.collection(collectionName), match, {
      after: param(search, "after"),
      before: param(search, "before"),
      ...("sortField" in config ? { field: config.sortField as string } : {}),
    }),
    boundedCount(database.collection(collectionName), match),
  ]);
  const relatedWorkspaces = await byIds(
    database.collection(physicalNames.workspaces),
    page.rows.map((row) => row.workspaceId),
    { name: 1, slug: 1 },
  );
  const relatedOwners =
    area === "workspaces"
      ? await byIds(
          database.collection(physicalNames.user),
          page.rows.map((row) => row.ownerUserId),
          { email: 1 },
        )
      : new Map();
  const summary =
    area === "jobs" ? await queueSummary(database, collectionName) : [];
  const stream =
    area === "jobs" && durableRedis()
      ? await Promise.all([
          durableRedis()!.xlen("clicks:stream"),
          durableRedis()!.xpending("clicks:stream", "ingest"),
        ]).catch(() => null)
      : null;
  const heartbeats =
    area === "jobs"
      ? await database
          .collection(physicalNames.worker_heartbeats)
          .find({})
          .limit(100)
          .toArray()
      : [];
  return (
    <>
      <PageHeader
        title={config.title}
        count={`${count.value.toLocaleString()}${count.capped ? "+" : ""}`}
      />
      <PageBody>
        {areaViews[area] ? (
          <nav
            aria-label="Billing views"
            className="flex flex-wrap gap-4 text-small text-signal"
          >
            {Object.entries(areaViews[area]!).map(([key, c]) => (
              <Link key={key} href={`/${area}?view=${key}`}>
                {c.title}
              </Link>
            ))}
          </nav>
        ) : null}
        {area === "jobs" ? (
          <>
            <AutoRefresh />
            <Section title="Queue summary">
              <DataTable
                columns={[
                  { id: "state", header: "State" },
                  { id: "count", header: "Count" },
                  { id: "stuck", header: "Expired leases" },
                  { id: "oldest", header: "Oldest created" },
                  { id: "failure", header: "Failure rate · 24h / 7d" },
                ]}
                rows={summary.map((s) => ({
                  id: String(s._id),
                  cells: {
                    state: s._id ?? "pending",
                    count: String(s.count),
                    stuck: String(s.stuck),
                    oldest: display(s.oldest),
                    failure: `${s.failed24 + s.completed24 ? Math.round((s.failed24 / (s.failed24 + s.completed24)) * 100) : 0}% / ${s.failed7 + s.completed7 ? Math.round((s.failed7 / (s.failed7 + s.completed7)) * 100) : 0}%`,
                  },
                }))}
              />
              {stream ? (
                <p className="text-meta text-fg-muted">
                  Click stream: {String(stream[0])} entries; pending:{" "}
                  {Array.isArray(stream[1])
                    ? String(stream[1][0])
                    : "Unavailable"}
                </p>
              ) : null}
            </Section>
          </>
        ) : null}
        <Filters keep={["view"]}>
          {area === "links" ? (
            <>
              <FilterSearch
                name="workspace"
                label="Workspace"
                placeholder="Workspace slug or ID"
              />
              {workspaceId ? (
                <>
                  <FilterSearch
                    name="tagQ"
                    label="Find tags"
                    placeholder="Search tags"
                  />
                  <FilterSelect
                    name="tag"
                    label="Tag"
                    options={tags.map((t) => ({
                      value: String(t._id),
                      label: String(t.name ?? t.tagName ?? t.nameLower),
                    }))}
                  />
                </>
              ) : null}
            </>
          ) : null}
          {area === "links" ? (
            <>
              <FilterSearch
                name="host"
                label="Destination host"
                placeholder="example.com"
              />
              <FilterSelect
                name="subdomains"
                label="Include subdomains"
                options={[{ value: "yes", label: "Yes" }]}
              />
            </>
          ) : null}
          {config.search.length || area === "links" ? (
            <FilterSearch
              label="Search"
              placeholder={
                area === "links" ? "Short URL, key or ID" : "Search or exact ID"
              }
            />
          ) : null}
          {area === "jobs" ? (
            <FilterSelect
              name="kind"
              label="Queue"
              allLabel={null}
              options={Object.keys(jobCollections).map((value) => ({
                value,
                label: value,
              }))}
            />
          ) : null}
          {config.facets?.map((f) => (
            <FilterSelect
              key={f.name}
              name={f.name}
              label={f.label}
              options={f.values.map((value) => ({ value, label: value }))}
            />
          ))}
        </Filters>
        <DataTable
          columns={config.fields.map(([id, header]) => ({ id, header }))}
          rows={page.rows.map((row) => ({
            id: String(row._id),
            ...(view && view !== "subscriptions"
              ? view === "events"
                ? { href: `/jobs/${row._id}?kind=billing` }
                : view === "overrides"
                  ? { href: `/workspaces/${row._id}` }
                  : {}
              : {
                  href: `/${area}/${row._id}${area === "jobs" ? `?kind=${kind}` : ""}`,
                }),
            cells: Object.fromEntries(
              config.fields.map(([key]) => [
                key,
                <span
                  key={key}
                  className="block max-w-80 truncate"
                  title={display(fieldValue(row, key))}
                >
                  {display(
                    (key === "workspaceId"
                      ? relatedWorkspaces.get(String(row.workspaceId))?.name
                      : key === "ownerUserId"
                        ? relatedOwners.get(String(row.ownerUserId))?.email
                        : undefined) ??
                      fieldValue(row, key) ??
                      (area === "audit" && key === "status"
                        ? "succeeded"
                        : undefined),
                  )}
                </span>,
              ]),
            ),
          }))}
          {...(area === "links"
            ? {
                selection: {
                  key: "links",
                  max: current.admin.role === "superadmin" ? 1000 : 100,
                  action: {
                    href: "/links/bulk",
                    label: "Review selected links",
                  },
                },
              }
            : {})}
          empty="Nothing matches these filters."
        />
        <Pager search={search} next={page.next} prev={page.prev} />
        {area === "reports" ? (
          <Link
            href="/links?safetyStatus=blocked"
            className="text-small text-signal"
          >
            Review blocked links
          </Link>
        ) : null}
        {heartbeats.length ? (
          <Section title="Worker loops">
            <DataTable
              columns={[
                { id: "name", header: "Loop" },
                { id: "run", header: "Last run" },
                { id: "duration", header: "Duration" },
                { id: "error", header: "Last error" },
              ]}
              rows={heartbeats.map((h) => ({
                id: String(h._id),
                cells: {
                  name: String(h._id),
                  run: display(h.lastRunAt),
                  duration: `${h.lastDurationMs} ms`,
                  error: display(h.lastError),
                },
              }))}
            />
          </Section>
        ) : null}
      </PageBody>
    </>
  );
}
