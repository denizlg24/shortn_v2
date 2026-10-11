import { listBioPages } from "@shortn/core";
import { can } from "@shortn/core/authz";
import { buttonVariants, cn } from "@shortn/ui";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { BioAvatar } from "@/components/bio/bio-avatar";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { bioPublicUrl } from "@/server/bio-page";
import { serviceContext } from "@/server/context";
import { billingOverview } from "@/server/plan";

export async function generateMetadata() {
  const t = await getTranslations("bio.list");
  return { title: t("title") };
}

export default async function BioPagesPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/bio">) {
  const { workspace } = await params;
  const { deleted } = await searchParams;
  const t = await getTranslations("bio.list");
  const format = await getFormatter();
  const ctx = await serviceContext(workspace);
  const [pages, overview] = await Promise.all([
    listBioPages(ctx),
    billingOverview(workspace),
  ]);
  const limit = overview.limits.bioPages;
  const canCreate = can(ctx.actor, "resource.create");
  const base = `/${workspace}/bio`;
  const shown = (slug: string) =>
    bioPublicUrl(slug).replace(/^https?:\/\//, "");
  const newButton = (className?: string) =>
    canCreate ? (
      <Link
        href={`${base}/new`}
        className={cn(
          buttonVariants({ variant: "primary", size: "lg" }),
          className,
        )}
      >
        {t("new")}
      </Link>
    ) : null;

  return (
    <Page
      crumbs={[{ label: t("title") }]}
      title={t("title")}
      description={
        limit === null
          ? t("count", { count: pages.length })
          : t("countOf", { count: pages.length, limit })
      }
      actions={newButton()}
    >
      {deleted ? <Notice tone="success">{t("deleted")}</Notice> : null}
      {pages.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-body text-fg-muted">{t("empty")}</p>
          {newButton("mt-4")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="border-b border-line text-left text-meta text-fg-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t("columns.page")}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium max-md:hidden">
                  {t("columns.url")}
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  {t("columns.links")}
                </th>
                <th
                  scope="col"
                  className="py-2 text-right font-medium max-sm:hidden"
                >
                  {t("columns.updated")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-bg-subtle">
                  <td className="py-2.5 pr-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <BioAvatar
                        url={page.avatarUrl}
                        name={page.title || page.slug}
                      />
                      <div className="min-w-0">
                        <Link
                          href={`${base}/${page.id}`}
                          className="font-medium text-fg hover:underline"
                        >
                          {page.title || page.slug}
                        </Link>
                        <p className="truncate font-mono text-meta text-fg-muted md:hidden">
                          {shown(page.slug)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-fg-muted max-md:hidden">
                    {shown(page.slug)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                    {format.number(page.linkCount)}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap text-fg-muted max-sm:hidden">
                    {format.dateTime(new Date(page.updatedAt), {
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
    </Page>
  );
}
