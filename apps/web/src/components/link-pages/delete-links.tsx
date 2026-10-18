"use client";

import { useTranslations } from "next-intl";
import { ConfirmDelete } from "../page/confirm-delete";
import { deleteLinksPageAction } from "@/server/actions/link-pages";

export function DeleteLinks({
  workspace,
  ids,
  items,
  cancelHref,
}: {
  workspace: string;
  ids: string[];
  items: string[];
  cancelHref: string;
}) {
  const t = useTranslations("linkPages.delete");
  const tErrors = useTranslations("links.errors");
  const consequences = t.raw("consequences");
  return (
    <ConfirmDelete
      items={items}
      consequences={
        Array.isArray(consequences)
          ? consequences.filter(
              (line): line is string => typeof line === "string",
            )
          : []
      }
      action={deleteLinksPageAction.bind(null, workspace, ids)}
      confirmLabel={
        ids.length > 1 ? t("confirmMany", { count: ids.length }) : t("confirm")
      }
      cancelHref={cancelHref}
      errorMessage={(code) =>
        code === "forbidden" ? tErrors("forbidden") : tErrors("generic")
      }
    />
  );
}
