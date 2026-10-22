import { ObjectId } from "mongodb";
import { keysetPage } from "@/server/list";
import { Pager } from "@/components/pager";
import { moderationCategories, physicalNames } from "@shortn/db";
import { notFound } from "next/navigation";
import { PageHeader, PageBody, Section } from "@/components/page";
import { DataTable } from "@/components/data-table";
import { ActionForm, fieldClass } from "@/components/action-form";
import { BulkReview } from "@/components/bulk-review";
import { freezeLinks, applyBulk } from "@/server/bulk-actions";
import { adminContext } from "@/server/session";
import { param } from "@/server/list";
export default async function BulkPage({
  searchParams,
}: PageProps<"/links/bulk">) {
  const ctx = await adminContext();
  const search = await searchParams;
  const key = param(search, "selection");
  const cap = ctx.admin.role === "superadmin" ? 1000 : 100;
  const snapshot = key
    ? await ctx.db
        .collection<{
          _id: string;
          userId: string;
          ids: string[];
          expiresAt: Date;
          outcomes?: { id: string; ok: boolean; error: string | null }[];
        }>(physicalNames.admin_bulk_selections)
        .findOne({
          _id: key,
          userId: ctx.admin.id,
          expiresAt: { $gt: ctx.now() },
        })
    : null;
  if (key && !snapshot) notFound();
  const review =
    snapshot && !snapshot.outcomes
      ? await keysetPage(
          ctx.db.collection(physicalNames.links),
          { _id: { $in: snapshot.ids.map((id) => new ObjectId(id)) } },
          {
            after: param(search, "after"),
            before: param(search, "before"),
            projection: { key: 1, domain: 1, longUrl: 1, moderation: 1 },
          },
        )
      : null;
  return (
    <>
      <PageHeader
        title="Bulk link moderation"
        crumbs={[{ label: "Links", href: "/links" }]}
      />
      <PageBody>
        {snapshot ? (
          <>
            <p className="text-small">
              {snapshot.ids.length} links frozen for this operation. Limit:{" "}
              {cap}. Confirmation expires after ten minutes.
            </p>
            {snapshot.outcomes ? (
              <DataTable
                columns={[
                  { id: "id", header: "Link" },
                  { id: "result", header: "Result" },
                ]}
                rows={snapshot.outcomes.map((o) => ({
                  id: o.id,
                  href: `/links/${o.id}`,
                  cells: { id: o.id, result: o.ok ? "Succeeded" : o.error },
                }))}
              />
            ) : (
              <>
                {review ? (
                  <>
                    <DataTable
                      columns={[
                        { id: "short", header: "Short link" },
                        { id: "destination", header: "Destination" },
                        { id: "state", header: "State" },
                      ]}
                      rows={review.rows.map((link) => ({
                        id: String(link._id),
                        href: `/links/${link._id}`,
                        cells: {
                          short: `${link.domain ?? ctx.linkDomain}/${link.key ?? link._id}`,
                          destination: (
                            <span
                              className="block max-w-96 truncate"
                              title={String(link.longUrl)}
                            >
                              {String(link.longUrl)}
                            </span>
                          ),
                          state: link.moderation ? "Taken down" : "Live",
                        },
                      }))}
                    />
                    <Pager
                      search={search}
                      next={review.next}
                      prev={review.prev}
                    />
                  </>
                ) : null}
                <ActionForm
                  action={applyBulk.bind(null, key!)}
                  submitLabel="Apply to frozen links"
                  cancelHref="/links"
                  confirm={String(snapshot.ids.length)}
                  danger
                >
                  <label htmlFor="operation" className="text-small">
                    Operation
                  </label>
                  <select
                    className={fieldClass}
                    id="operation"
                    name="operation"
                  >
                    <option value="takedown">Take down</option>
                    <option value="restore">Restore</option>
                  </select>
                  <label htmlFor="category" className="text-small">
                    Category
                  </label>
                  <select className={fieldClass} id="category" name="category">
                    {moderationCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </ActionForm>
              </>
            )}
          </>
        ) : (
          <>
            <BulkReview action={freezeLinks} max={cap} />
            {ctx.admin.role === "superadmin" ? (
              <Section title="All links to a destination host">
                <ActionForm
                  action={freezeLinks}
                  reason="none"
                  submitLabel="Freeze matching links"
                  cancelHref="/links"
                >
                  <label htmlFor="host" className="text-small">
                    Destination hostname (includes subdomains)
                  </label>
                  <input
                    id="host"
                    name="host"
                    className={fieldClass}
                    required
                    maxLength={253}
                  />
                </ActionForm>
              </Section>
            ) : null}
          </>
        )}
      </PageBody>
    </>
  );
}
