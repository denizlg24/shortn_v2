"use client";

import type { PlanId } from "@shortn/billing";
import type { LinkView, QrDesign } from "@shortn/core";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { useFormSubmit } from "../editor/use-form-submit";
import { LinkPicker } from "../editor/link-picker";
import { FormActions, FormField, inputClass } from "../page/form";
import { Section } from "../page/page";
import {
  QrDesignPreview,
  QrDesignSections,
  QrSplit,
  useQrDesign,
  type QrDesignError,
} from "./qr-design-editor";
import { useQrErrorMessage } from "./qr-errors";
import { TagsField } from "../page/tags-field";

export type AttachableLink = Pick<
  LinkView,
  "id" | "domain" | "key" | "url" | "qrCodeId"
>;

/** /qr/new: destination (or an existing link), details, then the design. */
export function QrCreateForm({
  base,
  previewData,
  allTags,
  logoGate,
  initialLink,
  workspace,
  action,
  cancelHref,
}: {
  /** The design a new code starts from. */
  base: QrDesign;
  /** A short URL of the real length, so the preview has the real density. */
  previewData: string;
  allTags: string[];
  logoGate: PlanId | null;
  /** From ?link=: the code is attached to this link and opens its URL. */
  initialLink: AttachableLink | null;
  workspace: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("qr");
  const message = useQrErrorMessage();
  const [link, setLink] = useState(initialLink);
  const [attempted, setAttempted] = useState(false);
  const design = useQrDesign({
    base,
    stored: emptyStored,
    data: previewData,
    whole: true,
  });
  const id = useId();

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
  const urlError =
    state.error && state.field === "url"
      ? message(state.error, state.detail)
      : undefined;
  const formError =
    state.error && !state.field ? message(state.error, state.detail) : null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <QrSplit
        preview={
          <QrDesignPreview
            state={design}
            alt={t("preview.altNew")}
            caption={
              <p className="text-center text-small text-pretty text-fg-muted">
                {t("form.previewHint")}
              </p>
            }
          />
        }
      >
        <Section title={t("form.destinationSection")}>
          {link ? (
            <div className="flex flex-col gap-3">
              <input type="hidden" name="link" value={link.id} />
              <input type="hidden" name="url" value={link.url} />
              <p className="text-small">
                {t.rich("form.usingLink", {
                  link: `${link.domain}/${link.key}`,
                  key: (chunks) => (
                    <span className="font-mono font-medium">{chunks}</span>
                  ),
                })}
              </p>
              <p className="truncate text-small text-fg-muted">
                {t("form.opens", { url: link.url })}
              </p>
              <p className="text-small text-fg-muted">
                {link.qrCodeId ? t("form.replacesCode") : t("form.attachHint")}
              </p>
              <button
                type="button"
                onClick={() => setLink(null)}
                className="self-start text-small text-signal hover:underline focus-visible:outline-2 focus-visible:outline-signal"
              >
                {t("form.useUrl")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <FormField
                id={`${id}-url`}
                label={t("form.url")}
                hint={t("form.urlHint")}
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
                  placeholder="https://"
                  autoFocus
                  aria-invalid={Boolean(urlError) || undefined}
                  aria-describedby={
                    urlError ? `${id}-url-error` : `${id}-url-hint`
                  }
                  className={inputClass}
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-small text-fg-muted">
                  {t("form.orLink")}
                </span>
                <LinkPicker
                  workspace={workspace}
                  onSelect={setLink}
                  trigger={
                    <button
                      type="button"
                      className="h-8 rounded-control border border-line-strong bg-field px-3 text-small font-medium hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-signal"
                    >
                      {t("form.pickLink")}
                    </button>
                  }
                />
              </div>
            </div>
          )}
        </Section>

        <Section title={t("form.detailsSection")}>
          <div className="flex flex-col gap-5">
            <FormField
              id={`${id}-title`}
              label={t("form.title")}
              optional={t("form.optional")}
              hint={t("form.titleHint")}
            >
              <input
                id={`${id}-title`}
                name="title"
                maxLength={200}
                aria-describedby={`${id}-title-hint`}
                className={inputClass}
              />
            </FormField>
            <TagsField
              id={`${id}-tags`}
              allTags={allTags}
              selected={[]}
              label={t("form.tags")}
            />
          </div>
        </Section>

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
          submitLabel={t("form.create")}
          cancelHref={cancelHref}
          cancelLabel={t("form.cancel")}
          pending={pending || design.uploading}
        />
      </QrSplit>
    </form>
  );
}

const emptyStored: Record<string, unknown> = {};
