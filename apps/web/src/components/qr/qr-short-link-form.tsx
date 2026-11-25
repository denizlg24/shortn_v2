"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { FormState } from "@/server/actions/link-pages";
import { useFormSubmit } from "../editor/use-form-submit";
import { FormActions, FormField, inputClass } from "../page/form";

export function QrShortLinkForm({
  domain,
  customKeys,
  action,
  cancelHref,
}: {
  domain: string;
  customKeys: boolean;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("qr.share");
  const errors = useTranslations("links.errors");
  const id = useId();
  const { state, pending, onSubmit } = useFormSubmit(action);
  const error = !state.error
    ? undefined
    : state.error === "invalid_key"
      ? errors("invalidKey")
      : state.error === "key_taken"
        ? errors("keyTaken", { key: String(state.detail?.key ?? "") })
        : state.error === "key_reserved"
          ? errors("keyReserved", { key: String(state.detail?.key ?? "") })
          : state.error === "limit_reached"
            ? errors("limitReached", {
                limit: Number(state.detail?.limit ?? 0),
              })
            : state.error === "forbidden"
              ? errors("forbidden")
              : t("failed");
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormField
        id={id}
        label={t("key")}
        hint={customKeys ? t("keyHint", { domain }) : t("generatedHint")}
        error={state.field === "key" ? error : undefined}
      >
        <input
          id={id}
          name="key"
          className={inputClass}
          disabled={!customKeys || pending}
          autoFocus={customKeys}
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          aria-invalid={state.field === "key" || undefined}
          aria-describedby={`${id}-${state.field === "key" ? "error" : "hint"}`}
        />
      </FormField>
      {error && state.field !== "key" ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("create")}
        cancelHref={cancelHref}
        cancelLabel={t("cancel")}
        pending={pending}
      />
    </form>
  );
}
