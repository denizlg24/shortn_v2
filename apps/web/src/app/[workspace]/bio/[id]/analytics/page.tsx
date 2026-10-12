import { bioAnalytics, readBioDraft } from "@shortn/core";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Page, Section } from "@/components/page/page";
import { serviceContext } from "@/server/context";
export default async function BioAnalyticsPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace, id } = await params,
    ctx = await serviceContext(workspace);
  const [stats, draft, t, f] = await Promise.all([
    bioAnalytics(ctx, id),
    readBioDraft(ctx, id),
    getTranslations("bio.analytics"),
    getFormatter(),
  ]);
  if (!stats || !draft) notFound();
  return (
    <Page
      title={t("title")}
      description={t("period")}
      crumbs={[
        { label: draft.handle, href: `/${workspace}/bio/${id}` },
        { label: t("title") },
      ]}
    >
      <dl className="mb-10 flex flex-wrap gap-x-12 gap-y-5 border-y border-line py-5">
        {[
          [t("views"), f.number(stats.views)],
          [t("clicks"), f.number(stats.clicks)],
          [
            t("ctr"),
            f.number(stats.ctr, { style: "percent", maximumFractionDigits: 1 }),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-small text-fg-muted">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <Section title={t("blocks")}>
        <table className="w-full text-left text-small">
          <thead>
            <tr>
              <th className="pb-3">{t("block")}</th>
              <th>{t("clicks")}</th>
              <th>{t("ctr")}</th>
            </tr>
          </thead>
          <tbody>
            {stats.blocks.map((block) => {
              const item = draft.content.blocks.find((b) => b.id === block._id);
              return (
                <tr
                  key={block._id ?? "unknown"}
                  className="border-t border-line"
                >
                  <td className="py-3">
                    {item && "title" in item
                      ? item.title || t("link")
                      : t("link")}
                  </td>
                  <td className="tabular-nums">{f.number(block.count)}</td>
                  <td>
                    {f.number(stats.views ? block.count / stats.views : 0, {
                      style: "percent",
                      maximumFractionDigits: 1,
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!stats.blocks.length ? (
          <p className="py-5 text-small text-fg-muted">{t("empty")}</p>
        ) : null}
      </Section>
      <Section title={t("referrers")}>
        <dl>
          {stats.referrers.map((row) => (
            <div
              className="flex justify-between border-b border-line py-3 text-small"
              key={row._id ?? "direct"}
            >
              <dt>{row._id ?? t("direct")}</dt>
              <dd className="tabular-nums">{f.number(row.count)}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </Page>
  );
}
