import { can } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CopyButton } from "@/components/page/copy-button";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { removeUtmVariantAction } from "@/server/actions/link-pages";
import { linkTabs, loadLink } from "@/server/link-page";

const fields = ["source", "medium", "campaign", "term", "content"] as const;

export async function generateMetadata() {
  const t = await getTranslations("linkPages.utm");
  return { title: t("title") };
}

export default async function LinkUtmPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/links/[id]/utm">) {
  const { workspace, id } = await params;
  const { saved } = await searchParams;
  const t = await getTranslations("linkPages");
  const { ctx, link } = await loadLink(workspace, id);
  const base = `/${workspace}/links/${id}`;
  const editable = can(ctx.actor, "resource.update");
  const shortUrl = `https://${link.domain}/${link.key}`;
  const tagged = (variant: (typeof link.utm)[number]) => {
    const query = new URLSearchParams();
    for (const field of fields) {
      const value = variant[field];
      if (value) query.set(`utm_${field}`, value);
    }
    return `${shortUrl}?${query}`;
  };
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: `${link.domain}/${link.key}`, href: base },
        { label: t("tabs.utm") },
      ]}
      title={`${link.domain}/${link.key}`}
      description={t("utm.description")}
      actions={
        editable ? (
          <Link
            href={`${base}/utm/new`}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            {t("utm.add")}
          </Link>
        ) : null
      }
      tabs={linkTabs(workspace, id, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      {saved ? <Notice tone="success">{t("utm.saved")}</Notice> : null}
      {link.utm.length === 0 ? (
        <p className="py-10 text-center text-small text-fg-muted">
          {t("utm.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="border-b border-line text-left text-meta text-fg-muted">
              <tr>
                {fields.map((field) => (
                  <th key={field} scope="col" className="py-2 pr-4 font-medium">
                    {t(`utm.fields.${field}`)}
                  </th>
                ))}
                <th scope="col" className="py-2 font-medium">
                  {t("utm.url")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {link.utm.map((variant, index) => (
                <tr key={index}>
                  {fields.map((field) => (
                    <td key={field} className="py-2.5 pr-4">
                      {variant[field] ?? (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                  ))}
                  <td className="py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyButton
                        value={tagged(variant)}
                        label={t("utm.copy")}
                        copiedLabel={t("overview.copied")}
                      />
                      {editable ? (
                        <>
                          <Link
                            href={`${base}/utm/${index}/edit`}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "md",
                            })}
                          >
                            {t("utm.edit")}
                          </Link>
                          <form
                            action={removeUtmVariantAction.bind(
                              null,
                              workspace,
                              id,
                              index,
                            )}
                          >
                            <button
                              type="submit"
                              className={buttonVariants({
                                variant: "dangerGhost",
                                size: "md",
                              })}
                            >
                              {t("utm.remove")}
                            </button>
                          </form>
                        </>
                      ) : null}
                    </div>
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
