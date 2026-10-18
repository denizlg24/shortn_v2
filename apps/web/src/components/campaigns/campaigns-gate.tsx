import type { PlanId } from "@shortn/billing";
import { buttonVariants } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import { Page } from "../page/page";
import { PlanGate } from "../plan-gate";

const gateId = "campaigns-gate";

/** Every campaign page on a plan without campaigns: what they are, how to get them. */
export async function CampaignsGate({ plan }: { plan: PlanId }) {
  const t = await getTranslations("campaigns");
  return (
    <Page
      crumbs={[{ label: t("list.title") }]}
      title={t("list.title")}
      actions={
        <button
          type="button"
          disabled
          aria-describedby={gateId}
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          {t("list.new")}
        </button>
      }
      width="form"
    >
      <p className="text-body font-medium text-pretty">{t("gated.title")}</p>
      <p className="mt-2 text-small text-pretty text-fg-muted">
        {t("gated.body")}
      </p>
      <PlanGate id={gateId} feature="campaigns" plan={plan} className="mt-5" />
    </Page>
  );
}
