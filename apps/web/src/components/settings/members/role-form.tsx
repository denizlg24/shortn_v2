"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormActions } from "@/components/page/form";
import type { SettingsFormState } from "@/server/actions/settings-pages";
import { RoleChoices } from "./role-choices";
import type { AssignableRole } from "./roles";

export function RoleForm({
  current,
  roles,
  action,
  cancelHref,
}: {
  current: AssignableRole;
  roles: AssignableRole[];
  action: (
    state: SettingsFormState,
    form: FormData,
  ) => Promise<SettingsFormState>;
  cancelHref: string;
}) {
  const t = useTranslations("settings");
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [role, setRole] = useState(current);

  const message = (code: string) => {
    switch (code) {
      case "forbidden":
        return t("member.adminOwnerOnly");
      case "owner_protected":
        return t("member.errors.ownerProtected");
      case "not_found":
        return t("member.errors.notFound");
      default:
        return t("common.errors.generic");
    }
  };

  return (
    <form action={formAction}>
      <RoleChoices
        roles={roles}
        value={role}
        onChange={setRole}
        legend={t("member.roleTitle")}
      />
      {state.error ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {message(state.error)}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("member.roleSubmit")}
        cancelHref={cancelHref}
        cancelLabel={t("common.cancel")}
        pending={pending}
      />
    </form>
  );
}
