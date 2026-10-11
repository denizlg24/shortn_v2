"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { FormActions, FormField, inputClass } from "@/components/page/form";
import { Section } from "@/components/page/page";
import type { SettingsFormState } from "@/server/actions/settings-pages";
import {
  normalizeSlugInput,
  workspaceNameMaxLength,
  workspaceSlugMaxLength,
} from "../rules";
import { useWorkspaceError } from "./use-workspace-error";

export function WorkspaceForm({
  name,
  slug,
  host,
  canUpdate,
  action,
}: {
  name: string;
  slug: string;
  host: string;
  canUpdate: boolean;
  action: (
    state: SettingsFormState,
    form: FormData,
  ) => Promise<SettingsFormState>;
}) {
  const t = useTranslations("settings.general");
  const message = useWorkspaceError();
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [values, setValues] = useState({ name, slug });
  const id = useId();
  const fieldError = (field: string) =>
    state.error && state.field === field ? message(state.error) : undefined;
  const formError = state.error && !state.field ? message(state.error) : null;

  return (
    <form action={formAction} noValidate>
      <Section
        title={t("identity.title")}
        description={canUpdate ? undefined : t("identity.readOnly")}
      >
        <div className="flex flex-col gap-4">
          <FormField
            id={`${id}-name`}
            label={t("identity.name")}
            error={fieldError("name")}
          >
            <input
              id={`${id}-name`}
              name="name"
              value={values.name}
              onChange={(event) =>
                setValues({ ...values, name: event.target.value })
              }
              maxLength={workspaceNameMaxLength}
              autoComplete="organization"
              disabled={!canUpdate}
              aria-invalid={Boolean(fieldError("name"))}
              className={inputClass}
            />
          </FormField>
          <FormField
            id={`${id}-slug`}
            label={t("identity.slug")}
            hint={t("identity.slugHint")}
            error={fieldError("slug")}
          >
            <div className="flex items-stretch">
              <span className="flex items-center rounded-l-control border border-r-0 border-line-strong bg-bg-subtle px-3 text-body text-fg-muted">
                {host}/
              </span>
              <input
                id={`${id}-slug`}
                name="slug"
                value={values.slug}
                onChange={(event) =>
                  setValues({
                    ...values,
                    slug: normalizeSlugInput(event.target.value),
                  })
                }
                maxLength={workspaceSlugMaxLength}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={!canUpdate}
                aria-invalid={Boolean(fieldError("slug"))}
                aria-describedby={`${id}-slug-${fieldError("slug") ? "error" : "hint"}`}
                className={`${inputClass} rounded-l-none`}
              />
            </div>
          </FormField>
        </div>
      </Section>
      {formError ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {formError}
        </p>
      ) : null}
      {canUpdate ? (
        <FormActions submitLabel={t("save")} pending={pending} />
      ) : null}
    </form>
  );
}
