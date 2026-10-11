"use client";

import { useTranslations } from "next-intl";
import type { CampaignView } from "@shortn/core";
import { SuggestionInput } from "../page/suggestion-input";
import { useId, useState } from "react";
import { FormActions, FormField } from "../page/form";
import { useFormSubmit } from "../editor/use-form-submit";
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
  campaigns,
  action,
  cancelHref,
}: {
  initial: UtmValues;
  campaigns: Pick<CampaignView, "title" | "utmDefaults">[];
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("linkPages.utm");
  const tErrors = useTranslations("linkPages.errors");
  const tLink = useTranslations("links.errors");
  const tPage = useTranslations("page");
  const { state, pending, onSubmit } = useFormSubmit(action);
  const id = useId();
  const [values, setValues] = useState(initial);
  const campaign = campaigns.find(
    (item) => item.title.toLowerCase() === values.campaign.trim().toLowerCase(),
  );
  const defaults = {
    source: campaign?.utmDefaults.sources ?? [],
    medium: campaign?.utmDefaults.mediums ?? [],
    term: campaign?.utmDefaults.terms ?? [],
    content: campaign?.utmDefaults.contents ?? [],
    campaign: campaigns.map((item) => item.title),
  };
  const error =
    state.error === "utm_empty" ||
    state.error === "utm_limit" ||
    state.error === "feature_required"
      ? tErrors(state.error)
      : state.error === "conflict" || state.error === "not_found"
        ? t("changed")
        : state.error === "forbidden"
          ? tLink("forbidden")
          : state.error
            ? tLink("generic")
            : null;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-small text-fg-muted">{t("defaultsHint")}</p>
      {fields.map(([field, max]) => (
        <FormField
          key={field}
          id={`${id}-${field}`}
          label={t(`fields.${field}`)}
          hint={t(`hints.${field}`)}
        >
          <SuggestionInput
            label={t(`fields.${field}`)}
            suggestions={defaults[field]}
            value={values[field]}
            onValueChange={(value) =>
              setValues((current) => ({ ...current, [field]: value }))
            }
            id={`${id}-${field}`}
            name={field}
            maxLength={max}
            aria-describedby={`${id}-${field}-hint`}
          />
        </FormField>
      ))}

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
