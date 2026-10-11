"use client";

import { useTranslations } from "next-intl";
import { ConfirmDelete } from "@/components/page/confirm-delete";
import { removeMemberPageAction } from "@/server/actions/settings-pages";

export function RemoveMember({
  workspace,
  userId,
  items,
  consequences,
  confirmLabel,
  cancelHref,
}: {
  workspace: string;
  userId: string;
  items: string[];
  consequences: string[];
  confirmLabel: string;
  cancelHref: string;
}) {
  const t = useTranslations("settings");
  return (
    <ConfirmDelete
      items={items}
      consequences={consequences}
      action={removeMemberPageAction.bind(null, workspace, userId)}
      confirmLabel={confirmLabel}
      cancelHref={cancelHref}
      errorMessage={(code) =>
        code === "forbidden"
          ? t("member.adminOwnerOnly")
          : code === "owner_protected"
            ? t("member.errors.ownerProtected")
            : code === "not_found"
              ? t("member.errors.notFound")
              : t("common.errors.generic")
      }
    />
  );
}
