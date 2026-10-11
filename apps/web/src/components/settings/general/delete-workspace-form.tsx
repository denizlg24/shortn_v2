"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { FormActions, FormField, inputClass } from "@/components/page/form";
import { strong } from "@/lib/rich-text";
import type { SettingsFormState } from "@/server/actions/settings-pages";
import { useWorkspaceError } from "./use-workspace-error";

// A confirmation page, not a dialog (17): what is lost, then the typed name.
export function DeleteWorkspaceForm({
  name,
  action,
  cancelHref,
}: {
  name: string;
  action: (
    state: SettingsFormState,
    form: FormData,
  ) => Promise<SettingsFormState>;
  cancelHref: string;
}) {
  const t = useTranslations("settings.delete");
  const message = useWorkspaceError();
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [typed, setTyped] = useState("");
  const id = useId();
  const confirmError =
    state.error && state.field === "confirm" ? message(state.error) : undefined;

  return (
    <form action={formAction} noValidate>
      <p className="mb-2 text-small font-medium">{t("whatHappens")}</p>
      <ul className="list-disc space-y-1 pl-5 text-small text-fg-muted">
        <li>{t("consequences.access")}</li>
        <li>{t("consequences.removed")}</li>
        <li>{t("consequences.final")}</li>
      </ul>
      <p className="mt-4 text-small text-fg-muted">{t("emptyFirst")}</p>
      <div className="mt-6">
        <FormField
          id={`${id}-confirm`}
          label={t.rich("confirmLabel", { name, strong })}
          error={confirmError}
        >
          <input
            id={`${id}-confirm`}
            name="confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(confirmError)}
            className={inputClass}
          />
        </FormField>
      </div>
      {state.error && !state.field ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {message(state.error)}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("confirm")}
        cancelHref={cancelHref}
        cancelLabel={t("cancel")}
        pending={pending}
        tone="danger"
      />
    </form>
  );
}
