"use client";

import { useTranslations } from "next-intl";
import { deleteQrsPageAction } from "@/server/actions/qr-pages";
import { ConfirmDelete } from "../page/confirm-delete";
import { useQrErrorMessage } from "./qr-errors";

export function DeleteQrs({
  workspace,
  ids,
  items,
  attached,
  cancelHref,
}: {
  workspace: string;
  ids: string[];
  items: string[];
  /** Some of the codes are attached to a link, which keeps working. */
  attached: boolean;
  cancelHref: string;
}) {
  const t = useTranslations("qr.deletePage");
  const message = useQrErrorMessage();
  return (
    <ConfirmDelete
      items={items}
      consequences={[
        t("stopsScanning", { count: ids.length }),
        t("history"),
        ...(attached ? [t("attached")] : []),
        t("permanent"),
      ]}
      action={deleteQrsPageAction.bind(null, workspace, ids)}
      confirmLabel={t("confirm", { count: ids.length })}
      cancelHref={cancelHref}
      errorMessage={(code) => message(code)}
    />
  );
}
