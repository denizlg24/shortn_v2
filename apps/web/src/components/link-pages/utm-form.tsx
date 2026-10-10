"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { FormActions, FormField, inputClass } from "../page/form";
import type { FormState } from "@/server/actions/link-pages";

const fields = [
  ["source", 100],
  ["medium", 100],
  ["campaign", 80],
  ["term", 100],
  ["content", 100],
] as const;

export type UtmValues = Record<(typeof fields)[number][0], string>;

export function UtmForm({
  initial,
  suggestions,
  action,
  cancelHref,
}: {
  initial: UtmValues;
  // Existing campaign titles, offered for the campaign field.
  suggestions: string[];
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("linkPages.utm");
  const tErrors = useTranslations("linkPages.errors");
  const tLink = useTranslations("links.errors");
  const tPage = useTranslations("page");
  const [state, formAction, pending] = useActionState(action, { error: null });
  const id = useId();
  const error =
    state.error === "utm_empty"
      ? tErrors("utm_empty")
      : state.error
        ? tLink("generic")
        : null;
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {fields.map(([field, max]) => (
        <FormField
          key={field}
          id={`${id}-${field}`}
          label={t(`fields.${field}`)}
          hint={t(`hints.${field}`)}
        >
          <input
            id={`${id}-${field}`}
            name={field}
            defaultValue={initial[field]}
            maxLength={max}
            list={field === "campaign" ? `${id}-campaigns` : undefined}
            aria-describedby={`${id}-${field}-hint`}
            className={inputClass}
          />
        </FormField>
      ))}
      <datalist id={`${id}-campaigns`}>
        {suggestions.map((title) => (
          <option key={title} value={title} />
        ))}
      </datalist>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("save")}
        cancelHref={cancelHref}
        cancelLabel={tPage("cancel")}
        pending={pending}
      />
    </form>
  );
}
