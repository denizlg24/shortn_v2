"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { useFormSubmit } from "../editor/use-form-submit";
import { FormActions, FormField, inputClass } from "../page/form";
import { Section } from "../page/page";
import { useQrErrorMessage } from "./qr-errors";
import { TagsField } from "../page/tags-field";

/** /qr/{id}/edit: where the code goes, and how it's filed. */
export function QrDetailsForm({
  initial,
  attachedLink,
  allTags,
  action,
  cancelHref,
}: {
  initial: { url: string; title: string; tags: string[] };
  /** Key of the link the code is attached to, e.g. "menu". */
  attachedLink: string | null;
  allTags: string[];
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("qr");
  const message = useQrErrorMessage();
  const { state, pending, onSubmit } = useFormSubmit(action);
  const id = useId();
  const urlError =
    state.error && state.field === "url"
      ? message(state.error, state.detail)
      : undefined;
  const formError =
    state.error && state.field !== "url"
      ? message(state.error, state.detail)
      : null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section title={t("form.destinationSection")}>
        <div className="flex flex-col gap-4">
          <FormField
            id={`${id}-url`}
            label={t("form.url")}
            hint={t("form.urlEditHint")}
            error={urlError}
          >
            <input
              id={`${id}-url`}
              name="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={2048}
              defaultValue={initial.url}
              aria-invalid={Boolean(urlError) || undefined}
              aria-describedby={urlError ? `${id}-url-error` : `${id}-url-hint`}
              className={inputClass}
            />
          </FormField>
          {attachedLink ? (
            <label className="flex items-start gap-2 text-small">
              <input
                type="checkbox"
                name="applyToLink"
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-signal)]"
              />
              <span className="flex flex-col gap-0.5">
                <span>
                  {t.rich("form.applyToLink", {
                    link: attachedLink,
                    key: (chunks) => (
                      <span className="font-mono font-medium">{chunks}</span>
                    ),
                  })}
                </span>
                <span className="text-fg-muted">
                  {t("form.applyToLinkHint")}
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </Section>

      <Section title={t("form.detailsSection")}>
        <div className="flex flex-col gap-5">
          <FormField
            id={`${id}-title`}
            label={t("form.title")}
            optional={t("form.optional")}
          >
            <input
              id={`${id}-title`}
              name="title"
              maxLength={200}
              defaultValue={initial.title}
              className={inputClass}
            />
          </FormField>
          <TagsField
            id={`${id}-tags`}
            allTags={allTags}
            selected={initial.tags}
            label={t("form.tags")}
          />
        </div>
      </Section>

      {formError ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {formError}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("form.save")}
        cancelHref={cancelHref}
        cancelLabel={t("form.cancel")}
        pending={pending}
      />
    </form>
  );
}
