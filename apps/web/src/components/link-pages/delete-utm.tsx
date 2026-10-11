"use client";

import type { UtmVariant } from "@shortn/core";
import { useTranslations } from "next-intl";
import type { DeleteState } from "../page/confirm-delete";
import { ConfirmDelete } from "../page/confirm-delete";

const fields = ["source", "medium", "campaign", "term", "content"] as const;

export function DeleteUtm({
  variant,
  action,
  cancelHref,
}: {
  variant: UtmVariant;
  action: (state: DeleteState, form: FormData) => Promise<DeleteState>;
  cancelHref: string;
}) {
  const t = useTranslations("linkPages.utm");
  const errors = useTranslations("links.errors");
  const pageErrors = useTranslations("linkPages.errors");
  return (
    <ConfirmDelete
      items={fields
        .filter((field) => variant[field])
        .map((field) => (
          <span className="block break-words">
            <span className="text-fg-muted">{t(`fields.${field}`)}: </span>
            {variant[field]}
          </span>
        ))}
      consequences={[t("deleteConsequence"), t("deleteCampaignConsequence")]}
      action={action}
      confirmLabel={t("deleteConfirm")}
      cancelHref={cancelHref}
      errorMessage={(code) =>
        code === "conflict" || code === "not_found"
          ? t("changed")
          : code === "forbidden"
            ? errors("forbidden")
            : code === "feature_required"
              ? pageErrors("feature_required")
              : errors("generic")
      }
    />
  );
}
