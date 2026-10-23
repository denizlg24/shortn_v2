"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { OptionGroup } from "../editor/option-group";
import { useFormSubmit } from "../editor/use-form-submit";
import { FormActions, FormField, inputClass } from "../page/form";

const categories = ["bug", "idea", "question", "other"] as const;
type Category = (typeof categories)[number];

const knownErrors = [
  "invalid_input",
  "message_required",
  "forbidden",
  "rate_limited",
] as const;
const isKnownError = (code: string): code is (typeof knownErrors)[number] =>
  (knownErrors as readonly string[]).includes(code);

export function FeedbackForm({
  action,
  page,
  maxLength,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  /** Where the user opened feedback from, so staff see the context. */
  page: string;
  maxLength: number;
}) {
  const t = useTranslations("feedback");
  const id = useId();
  const [category, setCategory] = useState<Category>("idea");
  const [length, setLength] = useState(0);
  const { state, pending, onSubmit } = useFormSubmit(action);
  const message = (code: string) =>
    isKnownError(code) ? t(`errors.${code}`) : t("errors.failed");
  const messageError =
    state.error && state.field === "message" ? message(state.error) : undefined;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="category" value={category} />
      {page ? <input type="hidden" name="page" value={page} /> : null}
      <div className="flex flex-col gap-2">
        <span id={`${id}-category`} className="text-small font-medium">
          {t("category")}
        </span>
        <OptionGroup
          labelledBy={`${id}-category`}
          value={category}
          onValueChange={setCategory}
          options={categories.map((value) => ({
            value,
            label: t(`categories.${value}`),
          }))}
        />
      </div>
      <FormField
        id={`${id}-message`}
        label={t("message")}
        hint={t("messageHint", { count: length, max: maxLength })}
        error={messageError}
      >
        <textarea
          id={`${id}-message`}
          name="message"
          required
          rows={7}
          maxLength={maxLength}
          placeholder={t(`placeholders.${category}`)}
          onChange={(event) => setLength(event.target.value.length)}
          aria-invalid={Boolean(messageError) || undefined}
          aria-describedby={
            messageError ? `${id}-message-error` : `${id}-message-hint`
          }
          className={`${inputClass} h-auto py-2`}
        />
      </FormField>
      {state.error && state.field !== "message" ? (
        <p role="alert" className="text-small text-danger">
          {message(state.error)}
        </p>
      ) : null}
      <FormActions submitLabel={t("send")} pending={pending} />
    </form>
  );
}
