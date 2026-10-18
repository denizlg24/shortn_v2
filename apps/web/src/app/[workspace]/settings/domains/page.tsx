import {
  can,
  domainAllowance,
  listBioPages,
  listDomains,
  listLinks,
} from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { Page, Section } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { CopyButton } from "@/components/page/copy-button";
import { GateNote, UpgradeLink } from "@/components/plan-gate";
import { billingOverview } from "@/server/plan";
import { serviceContext } from "@/server/context";
import { env } from "@/server/env";
import {
  addDomainAction,
  assignDomainLinkAction,
  buyDomainAddonAction,
  createDomainLinkAction,
  recoverDomainAction,
  removeDomainAction,
  retryDomainAction,
} from "@/server/actions/domains";
import { tourAnchor } from "@/lib/tour/anchors";
export default async function DomainsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { workspace } = await params,
    query = await searchParams,
    ctx = await serviceContext(workspace),
    e = env();
  const t = await getTranslations("settings.domains");
  const gate = await getTranslations("gate");
  const [domains, pages, allowance, links, overview] = await Promise.all([
    listDomains(ctx),
    listBioPages(ctx),
    domainAllowance(ctx.db, ctx.workspace._id),
    listLinks(ctx, { limit: 100 }),
    billingOverview(workspace),
  ]);
  // domainAllowance is 0 on Free even with an add-on, so Free needs a plan first.
  const freePlan = overview.plan === "free";
  const manage = can(ctx.actor, "billing.manage"),
    writes = e.DOMAIN_WRITES === "1",
    full = allowance <= domains.filter((d) => d.status !== "disabled").length;
  const input =
    "min-h-10 w-full rounded-control border border-line-strong bg-bg px-3 py-2 text-small text-fg";
  return (
    <Page
      title={t("title")}
      description={t("hint")}
      crumbs={[{ label: t("title") }]}
    >
      {query.saved ? <Notice tone="success">{t("saved")}</Notice> : null}
      {query.failed ? <Notice tone="warning">{t("failed")}</Notice> : null}
      {query.conflicts ? (
        <Notice tone="warning">{t("conflicts")}</Notice>
      ) : null}
      {!writes ? (
        <p
          className="mb-6 text-small text-fg-muted"
          {...tourAnchor("domains-add")}
        >
          {t("disabled")}
        </p>
      ) : null}
      {manage && writes ? (
        <Section title={t("add")} anchor="domains-add">
          {full ? (
            <GateNote id="domain-addon-gate" className="mb-4">
              {freePlan ? (
                <>
                  {t("addonPlan", { plan: gate("plans.basic") })}{" "}
                  <UpgradeLink />
                </>
              ) : allowance === 0 ? (
                t("addonNeeded")
              ) : (
                t("addonFull", { count: allowance })
              )}
            </GateNote>
          ) : null}
          <form
            action={addDomainAction.bind(null, workspace)}
            className="grid max-w-lg gap-4"
          >
            <label className="grid gap-1 text-small">
              {t("hostname")}
              <input
                name="hostname"
                required
                maxLength={253}
                placeholder="go.example.com"
                className={input}
              />
            </label>
            <label className="grid gap-1 text-small">
              {t("kind")}
              <select name="kind" className={input}>
                <option value="links">Links</option>
                <option value="bio">Bio</option>
                <option value="both">Links + Bio</option>
              </select>
            </label>
            <label className="grid gap-1 text-small">
              {t("bioPage")}
              <select name="bioPageId" className={input}>
                <option value="">—</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title || page.slug}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={full}
              aria-describedby={full ? "domain-addon-gate" : undefined}
              className="min-h-10 justify-self-start rounded-control bg-primary px-4 text-primary-fg disabled:opacity-50"
              type="submit"
            >
              {t("add")}
            </button>
          </form>
          {full &&
          !freePlan &&
          e.BILLING_WRITES === "1" &&
          e.POLAR_DOMAIN_PRODUCT_ID ? (
            <form action={buyDomainAddonAction.bind(null, workspace)}>
              <button
                type="submit"
                className="mt-5 min-h-10 text-small text-signal underline"
              >
                {t("addon")}
              </button>
            </form>
          ) : null}
        </Section>
      ) : null}
      {!domains.length ? (
        <p className="py-8 text-fg-muted">{t("empty")}</p>
      ) : (
        domains.map((domain) => (
          <Section
            key={domain.id}
            title={domain.hostname}
            description={
              domain.status === "active"
                ? t("active")
                : domain.status === "failed"
                  ? t("error")
                  : domain.status === "disabled"
                    ? t("removed")
                    : t("pending")
            }
          >
            {domain.status !== "disabled" ? (
              <>
                <h3 className="mb-2 text-small font-medium">{t("dns")}</h3>
                <p className="mb-4 text-small text-fg-muted">{t("dnsHint")}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-small">
                    <thead>
                      <tr>
                        <th className="py-2">Type</th>
                        <th>{t("name")}</th>
                        <th>{t("value")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-line">
                        <td className="py-3">CNAME</td>
                        <td className="font-mono">{domain.hostname}</td>
                        <td>
                          <span className="font-mono">
                            {e.DOMAIN_CNAME_TARGET}
                          </span>
                          <CopyButton
                            value={e.DOMAIN_CNAME_TARGET}
                            label={t("value")}
                            copiedLabel={t("saved")}
                          />
                        </td>
                      </tr>
                      {domain.verification.name && domain.verification.value ? (
                        <tr>
                          <td>TXT</td>
                          <td className="break-all font-mono">
                            {domain.verification.name}
                          </td>
                          <td className="break-all font-mono">
                            {domain.verification.value}
                          </td>
                        </tr>
                      ) : null}
                      {domain.validationRecords.map((record, i) =>
                        record.txt_name && record.txt_value ? (
                          <tr key={i}>
                            <td>TXT</td>
                            <td className="break-all font-mono">
                              {record.txt_name}
                            </td>
                            <td className="break-all font-mono">
                              {record.txt_value}
                            </td>
                          </tr>
                        ) : null,
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            {writes &&
            can(ctx.actor, "resource.update") &&
            domain.status === "active" &&
            domain.kind !== "bio" ? (
              <form
                className="mt-5 grid max-w-lg gap-3"
                action={assignDomainLinkAction.bind(null, workspace, domain.id)}
              >
                <label className="grid gap-1 text-small">
                  {t("assignLink")}
                  <select name="linkId" required className={input}>
                    {links.links.map((link) => (
                      <option key={link.id} value={link.id}>
                        {link.title || link.key} — {link.domain}/{link.key}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-small text-fg-muted">{t("assignHint")}</p>
                <button
                  type="submit"
                  className="min-h-10 justify-self-start text-small text-signal underline"
                >
                  {t("assignLink")}
                </button>
              </form>
            ) : null}
            {writes &&
            can(ctx.actor, "resource.create") &&
            domain.status === "active" &&
            domain.kind !== "bio" ? (
              <form
                className="mt-5 grid max-w-lg gap-3"
                action={createDomainLinkAction.bind(null, workspace, domain.id)}
              >
                <h3 className="font-medium">{t("createLink")}</h3>
                <label className="grid gap-1 text-small">
                  {t("destination")}
                  <input type="url" name="url" required className={input} />
                </label>
                <label className="grid gap-1 text-small">
                  {t("key")}
                  <input
                    name="key"
                    pattern="[A-Za-z0-9_-]{1,64}"
                    className={input}
                  />
                </label>
                <button
                  type="submit"
                  className="min-h-10 justify-self-start text-small text-signal underline"
                >
                  {t("createLink")}
                </button>
              </form>
            ) : null}
            {domain.error ? (
              <p className="mt-3 text-small text-danger">{domain.error}</p>
            ) : null}
            {manage ? (
              <div className="mt-5 flex flex-wrap gap-5 text-small">
                {domain.status === "failed" ? (
                  <form
                    action={retryDomainAction.bind(null, workspace, domain.id)}
                  >
                    <button
                      type="submit"
                      className="min-h-9 text-signal underline"
                    >
                      {t("retry")}
                    </button>
                  </form>
                ) : null}
                {domain.status !== "disabled" ? (
                  <form
                    action={removeDomainAction.bind(null, workspace, domain.id)}
                  >
                    <button type="submit" className="min-h-9 text-danger">
                      {t("remove")}
                    </button>
                    <p className="text-fg-muted">{t("removeHint")}</p>
                  </form>
                ) : (
                  <form
                    action={recoverDomainAction.bind(
                      null,
                      workspace,
                      domain.id,
                    )}
                  >
                    <button
                      type="submit"
                      className="min-h-9 text-signal underline"
                    >
                      {t("recover")}
                    </button>
                  </form>
                )}
              </div>
            ) : null}
          </Section>
        ))
      )}
    </Page>
  );
}
