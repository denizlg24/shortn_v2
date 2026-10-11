"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormActions } from "@/components/page/form";
import type { SettingsFormState } from "@/server/actions/settings-pages";
import { useBillingError } from "./use-billing-error";

/** Plan change and cancellation get a page that says what happens (17). */
export function BillingConfirm({
  consequences,
  action,
  submitLabel,
  cancelLabel,
  cancelHref,
  tone,
}: {
  consequences: string[];
  action: (
    state: SettingsFormState,
    form: FormData,
  ) => Promise<SettingsFormState>;
  submitLabel: string;
  cancelLabel: string;
  cancelHref: string;
  tone: "primary" | "danger";
}) {
  const t = useTranslations("billing");
  const errorFor = useBillingError();
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction}>
      <p className="mb-2 text-small font-medium">{t("confirm.whatHappens")}</p>
      <ul className="list-disc space-y-1 pl-5 text-small text-fg-muted">
        {consequences.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {state.error ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {errorFor(state.error)}
        </p>
      ) : null}
      <FormActions
        submitLabel={submitLabel}
        cancelHref={cancelHref}
        cancelLabel={cancelLabel}
        pending={pending}
        tone={tone}
      />
    </form>
  );
}
