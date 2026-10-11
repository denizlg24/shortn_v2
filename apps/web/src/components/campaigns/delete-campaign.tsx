"use client";

import { useTranslations } from "next-intl";
import { deleteCampaignPageAction } from "@/server/actions/campaign-pages";
import { ConfirmDelete } from "../page/confirm-delete";
import { useCampaignErrorMessage } from "./campaign-errors";

export function DeleteCampaign({
  workspace,
  id,
  title,
  linkCount,
  cancelHref,
}: {
  workspace: string;
  id: string;
  title: string;
  linkCount: number;
  cancelHref: string;
}) {
  const t = useTranslations("campaigns.deletePage");
  const message = useCampaignErrorMessage();
  return (
    <ConfirmDelete
      items={[title]}
      consequences={[
        t("variants", { count: linkCount }),
        t("links"),
        t("analytics"),
        t("permanent"),
      ]}
      action={deleteCampaignPageAction.bind(null, workspace, id)}
      confirmLabel={t("confirm")}
      cancelHref={cancelHref}
      errorMessage={(code) => message(code)}
    />
  );
}
