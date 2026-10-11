"use client";

import { useTranslations } from "next-intl";
import { deleteBioPageAction } from "@/server/actions/bio-pages";
import { ConfirmDelete } from "../page/confirm-delete";
import { useBioErrorMessage } from "./bio-errors";

export function DeleteBio({
  workspace,
  id,
  url,
  cancelHref,
}: {
  workspace: string;
  id: string;
  /** The public address, e.g. shortn.at/b/ana. */
  url: string;
  cancelHref: string;
}) {
  const t = useTranslations("bio.deletePage");
  const message = useBioErrorMessage();
  return (
    <ConfirmDelete
      items={[url]}
      consequences={[t("stops", { url }), t("links"), t("address")]}
      action={deleteBioPageAction.bind(null, workspace, id)}
      confirmLabel={t("confirm")}
      cancelHref={cancelHref}
      errorMessage={(code) => message(code)}
    />
  );
}
