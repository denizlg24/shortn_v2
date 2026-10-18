import type { PlanId } from "@shortn/billing";
import type { LinkView } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import { linkTabs } from "@/server/link-page";
import { Page } from "../page/page";
import { PlanGate } from "../plan-gate";

export async function UtmGate({
  workspace,
  link,
  plan,
}: {
  workspace: string;
  link: LinkView;
  plan: PlanId;
}) {
  const t = await getTranslations("linkPages");
  const base = `/${workspace}/links/${link.id}`;
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: `${link.domain}/${link.key}`, href: base },
        { label: t("tabs.utm") },
      ]}
      title={`${link.domain}/${link.key}`}
      description={t("utm.description")}
      tabs={linkTabs(workspace, link.id, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
      actions={
        <button
          type="button"
          disabled
          aria-describedby="utm-gate"
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          {t("utm.add")}
        </button>
      }
    >
      <PlanGate id="utm-gate" feature="campaigns" plan={plan} />
    </Page>
  );
}
