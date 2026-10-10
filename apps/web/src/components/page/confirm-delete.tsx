"use client";

import { useTranslations } from "next-intl";
import { useActionState, type ReactNode } from "react";
import { FormActions } from "./form";

export type DeleteState = { error: string | null };

// Destructive actions get their own page (17: owner decision): what will be
// lost, then one confirm button. The action redirects on success.
export function ConfirmDelete({
  consequences,
  items,
  action,
  confirmLabel,
  cancelHref,
  errorMessage,
}: {
  consequences: ReactNode[];
  items?: ReactNode[];
  action: (state: DeleteState, form: FormData) => Promise<DeleteState>;
  confirmLabel: string;
  cancelHref: string;
  errorMessage?: (code: string) => string;
}) {
  const t = useTranslations("page.delete");
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction}>
      {items?.length ? (
        <ul className="mb-5 divide-y divide-line border-y border-line">
          {items.map((item, index) => (
            <li key={index} className="py-2.5 text-small">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mb-2 text-small font-medium">{t("whatHappens")}</p>
      <ul className="list-disc space-y-1 pl-5 text-small text-fg-muted">
        {consequences.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      {state.error ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {errorMessage ? errorMessage(state.error) : t("failed")}
        </p>
      ) : null}
      <FormActions
        submitLabel={confirmLabel}
        cancelHref={cancelHref}
        cancelLabel={t("cancel")}
        pending={pending}
        tone="danger"
      />
    </form>
  );
}
