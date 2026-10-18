"use client";

import type { PlanId } from "@shortn/billing";
import type { QrDesign } from "@shortn/core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { useFormSubmit } from "../editor/use-form-submit";
import { FormActions } from "../page/form";
import {
  QrDesignPreview,
  QrDesignSections,
  QrSplit,
  useQrDesign,
  type QrDesignError,
} from "./qr-design-editor";
import { useQrErrorMessage } from "./qr-errors";

/** /qr/{id}/design: controls left, the code at its printed size right. */
export function QrDesignForm({
  design: base,
  stored,
  shortUrl,
  linkLabel,
  logoGate,
  action,
  cancelHref,
}: {
  design: QrDesign;
  stored: Record<string, unknown>;
  shortUrl: string;
  /** e.g. shortn.at/AbC123, for the preview's alt text. */
  linkLabel: string;
  logoGate: PlanId | null;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("qr");
  const message = useQrErrorMessage();
  const [attempted, setAttempted] = useState(false);
  const design = useQrDesign({ base, stored, data: shortUrl, whole: false });

  const { state, pending, onSubmit } = useFormSubmit(action, () => {
    setAttempted(true);
    return !design.problem;
  });

  const guard = design.problem && attempted ? design.problem : null;
  const designError: QrDesignError | null = guard
    ? {
        field: guard === "logoUrl" ? "logo" : "design",
        message: t(`errors.${guard}`),
      }
    : state.field === "logo" || state.field === "design"
      ? {
          field: state.field,
          message: message(state.error ?? "", state.detail),
        }
      : null;
  const formError =
    state.error && !state.field ? message(state.error, state.detail) : null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <QrSplit
        preview={
          <QrDesignPreview
            state={design}
            alt={t("preview.alt", { link: linkLabel })}
            caption={
              <p className="text-center text-small text-pretty text-fg-muted">
                {design.dirty ? t("design.unsaved") : t("design.printed")}
              </p>
            }
          />
        }
      >
        <QrDesignSections
          state={design}
          logoGate={logoGate}
          error={designError}
        />
        <input
          type="hidden"
          name="design"
          value={JSON.stringify(design.posted)}
        />
        {formError ? (
          <p role="alert" className="mt-4 text-small text-danger">
            {formError}
          </p>
        ) : null}
        <FormActions
          submitLabel={t("design.save")}
          cancelHref={cancelHref}
          cancelLabel={t("form.cancel")}
          pending={pending || design.uploading}
        />
      </QrSplit>
    </form>
  );
}
