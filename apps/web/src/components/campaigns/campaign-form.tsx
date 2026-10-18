"use client";

import type { UtmDefaults } from "@shortn/core";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { useFormSubmit } from "../editor/use-form-submit";
import { FormActions, FormField, inputClass } from "../page/form";
import { Section } from "../page/page";
import { useCampaignErrorMessage } from "./campaign-errors";
import { ChipListField } from "./chip-list-field";

const lists = ["sources", "mediums", "terms", "contents"] as const;

/**
 * /campaigns/new (title and description) and /campaigns/{id}/edit, which
 * adds the UTM defaults the builder suggests.
 */
export function CampaignForm({
  mode,
  initial,
  action,
  cancelHref,
}: {
  mode: "create" | "edit";
  initial: { title: string; description: string; utmDefaults: UtmDefaults };
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("campaigns");
  const message = useCampaignErrorMessage();
  const { state, pending, onSubmit } = useFormSubmit(action);
  const [title, setTitle] = useState(initial.title);
  const id = useId();
  const titleError =
    state.error && state.field === "title"
      ? message(state.error, state.detail)
      : undefined;
  const formError =
    state.error && !state.field ? message(state.error, state.detail) : null;
  const renaming =
    mode === "edit" && title.trim() !== "" && title.trim() !== initial.title;

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section title={t("form.detailsSection")}>
        <div className="flex flex-col gap-5">
          <FormField
            id={`${id}-title`}
            label={t("form.title")}
            hint={renaming ? t("form.renameHint") : t("form.titleHint")}
            error={titleError}
          >
            <input
              id={`${id}-title`}
              name="title"
              required
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus={mode === "create"}
              aria-invalid={Boolean(titleError) || undefined}
              aria-describedby={
                titleError ? `${id}-title-error` : `${id}-title-hint`
              }
              className={inputClass}
            />
          </FormField>
          <FormField
            id={`${id}-description`}
            label={t("form.description")}
            optional={t("form.optional")}
          >
            <textarea
              id={`${id}-description`}
              name="description"
              rows={3}
              maxLength={500}
              defaultValue={initial.description}
              placeholder={t("form.descriptionPlaceholder")}
              className={`${inputClass} h-auto py-2`}
            />
          </FormField>
        </div>
      </Section>

      {mode === "edit" ? (
        <Section
          title={t("defaults.title")}
          description={t("defaults.description")}
        >
          <div className="flex flex-col gap-5">
            {lists.map((list) => (
              <FormField
                key={list}
                id={`${id}-${list}`}
                label={t(`defaults.lists.${list}`)}
                hint={t(`defaults.hints.${list}`)}
              >
                <ChipListField
                  id={`${id}-${list}`}
                  name={list}
                  initial={initial.utmDefaults[list]}
                  placeholder={t(`defaults.placeholders.${list}`)}
                  describedBy={`${id}-${list}-hint`}
                />
              </FormField>
            ))}
          </div>
        </Section>
      ) : null}

      {formError ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {formError}
        </p>
      ) : null}
      <FormActions
        submitLabel={mode === "create" ? t("form.create") : t("form.save")}
        cancelHref={cancelHref}
        cancelLabel={t("form.cancel")}
        pending={pending}
      />
    </form>
  );
}
