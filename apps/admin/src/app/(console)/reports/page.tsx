import { physicalNames } from "@shortn/db";
import { ObjectId } from "mongodb";
import Link from "next/link";
import { PageHeader, PageBody } from "@/components/page";
import { DataTable } from "@/components/data-table";
import { Filters, FilterSelect } from "@/components/filters";
import { Pager } from "@/components/pager";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { groupedReports } from "@/server/reports";
export default async function Reports({ searchParams }: PageProps<"/reports">) {
  await requireAdmin();
  const search = await searchParams;
  const database = await db();
  const page = await groupedReports(database, search);
  const ids = page.rows.flatMap((r) =>
    r._id instanceof ObjectId ? [r._id] : [],
  );
  const codes = page.rows.flatMap((r) =>
    typeof r._id === "string" ? [r._id] : [],
  );
  const links = await database
    .collection(physicalNames.links)
    .find(
      { $or: [{ _id: { $in: ids } }, { urlCode: { $in: codes } }] },
      {
        projection: {
          key: 1,
          urlCode: 1,
          longUrl: 1,
          safetyStatus: 1,
          moderation: 1,
          disabledReason: 1,
          workspaceId: 1,
        },
      },
    )
    .limit(50)
    .toArray();
  return (
    <>
      <PageHeader title="Reports" />
      <PageBody>
        <Filters>
          <FilterSelect
            name="status"
            label="Status"
            allLabel={null}
            options={[
              { value: "open", label: "Open" },
              { value: "reviewed", label: "Reviewed" },
              { value: "dismissed", label: "Dismissed" },
            ]}
          />
          <FilterSelect
            name="sort"
            label="Sort"
            allLabel={null}
            options={[
              { value: "newest", label: "Newest report" },
              { value: "oldest", label: "Oldest open" },
              { value: "count", label: "Most reports" },
            ]}
          />
        </Filters>
        <DataTable
          columns={[
            { id: "link", header: "Link" },
            { id: "destination", header: "Destination" },
            { id: "reports", header: "Reports" },
            { id: "reasons", header: "Reasons" },
            { id: "first", header: "First report" },
            { id: "last", header: "Last report" },
            { id: "state", header: "State" },
          ]}
          rows={page.rows.map((group) => {
            const link = links.find(
              (l) =>
                String(l._id) === String(group._id) || l.urlCode === group._id,
            );
            return {
              id: String(group._id),
              ...(link ? { href: `/links/${link._id}?tab=reports` } : {}),
              cells: {
                link: link?.key ?? link?.urlCode ?? "Deleted link",
                destination: (
                  <span className="block max-w-80 truncate">
                    {link?.longUrl ?? "—"}
                  </span>
                ),
                reports: String(group.count),
                reasons: group.reasons.join(", "),
                first: group.first?.toISOString() ?? "—",
                last: group.last?.toISOString() ?? "—",
                state: link?.moderation
                  ? "Taken down"
                  : (link?.disabledReason ?? link?.safetyStatus ?? "Deleted"),
              },
            };
          })}
        />
        <Pager search={search} next={page.next} />
        <Link href="/links?autoBlocked=yes" className="text-small text-signal">
          Review auto-blocked links
        </Link>
      </PageBody>
    </>
  );
}
