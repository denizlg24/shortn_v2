"use client";

import { Button } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { deleteWorkspaceAction } from "@/server/actions/workspace";
import { ConfirmDialog } from "../confirm-dialog";
import { SettingsSection } from "../section";
import { strong } from "@/lib/rich-text";

export function DeleteWorkspace({
  name,
  slug,
  personal,
  canDelete,
}: {
  name: string;
  slug: string;
  personal: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);

  const confirm = async () => {
    const result = await deleteWorkspaceAction(slug);
    if (result.ok) {
      // A full load drops every cached payload of the deleted workspace.
      window.location.assign("/");
      return null;
    }
    switch (result.error) {
      case "not_empty":
        return t("general.delete.notEmpty");
      case "forbidden":
        return t("general.delete.ownerOnly");
      default:
        return t("common.errors.generic");
    }
  };

  return (
    <SettingsSection
      tone="danger"
      title={t("general.delete.title")}
      description={
        personal
          ? t("general.delete.personal")
          : t("general.delete.description", { workspace: name })
      }
    >
      {personal ? null : (
        <>
          <div>
            <Button
              variant="danger"
              onClick={() => setOpen(true)}
              {...(canDelete
                ? {}
                : { disabledReason: t("general.delete.ownerOnly") })}
            >
              {t("general.delete.action")}
            </Button>
          </div>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title={t("general.delete.dialogTitle", { workspace: name })}
            description={t("general.delete.dialogBody")}
            confirmLabel={t("general.delete.confirm")}
            typedConfirmation={{
              value: slug,
              label: t.rich("general.delete.confirmLabel", { slug, strong }),
            }}
            onConfirm={confirm}
          />
        </>
      )}
    </SettingsSection>
  );
}
