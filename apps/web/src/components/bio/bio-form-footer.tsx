"use client";

import { useTranslations } from "next-intl";
import type { FormState } from "@/server/actions/link-pages";
import { FormActions } from "../page/form";
import { useBioErrorMessage } from "./bio-errors";

/** The error from the last save, then the tab's save and cancel. */
export function BioFormFooter({
  state,
  pending,
  submitLabel,
  cancelHref,
}: {
  state: FormState;
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
}) {
  const t = useTranslations("bio");
  const message = useBioErrorMessage();
  return (
    <>
      {state.error ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {message(state.error, state.detail)}
        </p>
      ) : null}
      <FormActions
        submitLabel={submitLabel}
        cancelHref={cancelHref}
        cancelLabel={t("form.cancel")}
        pending={pending}
      />
    </>
  );
}
