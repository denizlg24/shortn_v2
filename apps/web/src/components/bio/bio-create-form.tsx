"use client";

import type { LinkView } from "@shortn/core";
import { cn } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { checkBioSlugAction } from "@/server/actions/bio-pages";
import type { FormState } from "@/server/actions/link-pages";
import { LinkPicker } from "../editor/link-picker";
import { useFormSubmit } from "../editor/use-form-submit";
import { FormActions, FormField, inputClass } from "../page/form";
import { Section } from "../page/page";
import { useBioErrorMessage } from "./bio-errors";
import { isBioSlug, normalizeSlug, slugMaxLength } from "./bio-rules";

const checkDelayMs = 300;

type Availability =
  | { slug: string; status: "available" | "taken" | "invalid" }
  | { slug: string; status: "failed" };

/** /bio/new: the address (checked as you type), a title, a first link. */
export function BioCreateForm({
  workspace,
  host,
  action,
  cancelHref,
}: {
  workspace: string;
  /** Public host the slug sits under, e.g. shortn.at. */
  host: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("bio");
  const message = useBioErrorMessage();
  const { state, pending, onSubmit } = useFormSubmit(action);
  const id = useId();
  const [slug, setSlug] = useState("");
  const [checked, setChecked] = useState<Availability | null>(null);
  const [link, setLink] = useState<LinkView | null>(null);

  useEffect(() => {
    if (!isBioSlug(slug)) return;
    let live = true;
    const timer = window.setTimeout(() => {
      checkBioSlugAction(workspace, slug).then(
        (status) => {
          if (live) setChecked({ slug, status });
        },
        () => {
          if (live) setChecked({ slug, status: "failed" });
        },
      );
    }, checkDelayMs);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [workspace, slug]);

  const status = !slug
    ? null
    : !isBioSlug(slug)
      ? "invalid"
      : checked?.slug === slug
        ? checked.status
        : "checking";
  const slugError =
    state.error && state.field === "slug"
      ? message(state.error, state.detail)
      : undefined;
  const formError =
    state.error && state.field !== "slug"
      ? message(state.error, state.detail)
      : null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section title={t("new.addressSection")}>
        <FormField
          id={`${id}-slug`}
          label={t("new.slug")}
          hint={t("new.slugHint")}
          error={slugError}
        >
          <div className="flex items-stretch">
            <span className="flex items-center rounded-l-control border border-r-0 border-line-strong bg-bg-subtle px-3 font-mono text-small whitespace-nowrap text-fg-muted">
              {host}/b/
            </span>
            <input
              id={`${id}-slug`}
              name="slug"
              required
              autoFocus
              value={slug}
              maxLength={slugMaxLength}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("new.slugPlaceholder")}
              onChange={(event) => setSlug(normalizeSlug(event.target.value))}
              aria-invalid={
                Boolean(slugError) || status === "taken" || undefined
              }
              aria-describedby={`${id}-slug-status ${
                slugError ? `${id}-slug-error` : `${id}-slug-hint`
              }`}
              className={cn(inputClass, "rounded-l-none font-mono")}
            />
          </div>
        </FormField>
        <p
          id={`${id}-slug-status`}
          aria-live="polite"
          className={cn(
            "mt-2 min-h-5 text-small",
            status === "available" && "text-success",
            (status === "taken" || status === "invalid") && "text-danger",
            (status === "checking" || status === "failed") && "text-fg-muted",
          )}
        >
          {status === "available"
            ? t("new.available", { url: `${host}/b/${slug}` })
            : status === "taken"
              ? t("errors.slugTaken")
              : status === "invalid" && slug.length >= 3
                ? t("errors.invalidSlug")
                : status === "checking"
                  ? t("new.checking")
                  : status === "failed"
                    ? t("new.checkFailed")
                    : null}
        </p>
      </Section>

      <Section title={t("new.detailsSection")}>
        <div className="flex flex-col gap-5">
          <FormField
            id={`${id}-title`}
            label={t("new.titleLabel")}
            hint={t("new.titleHint")}
            optional={t("form.optional")}
          >
            <input
              id={`${id}-title`}
              name="title"
              maxLength={120}
              aria-describedby={`${id}-title-hint`}
              className={inputClass}
            />
          </FormField>
          <div className="flex flex-col gap-2">
            <p className="flex items-baseline gap-2 text-small font-medium">
              {t("new.firstLink")}
              <span className="text-meta font-normal text-fg-subtle">
                {t("form.optional")}
              </span>
            </p>
            {link ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
                <input type="hidden" name="link" value={link.id} />
                <span className="font-mono">
                  <span className="text-fg-muted">{link.domain}/</span>
                  {link.key}
                </span>
                <button
                  type="button"
                  onClick={() => setLink(null)}
                  className="text-signal hover:underline focus-visible:outline-2 focus-visible:outline-signal"
                >
                  {t("new.removeLink")}
                </button>
              </div>
            ) : (
              <LinkPicker
                workspace={workspace}
                onSelect={setLink}
                trigger={
                  <button
                    type="button"
                    className="h-8 self-start rounded-control border border-line-strong bg-field px-3 text-small font-medium hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-signal"
                  >
                    {t("new.pickLink")}
                  </button>
                }
              />
            )}
            <p className="text-small text-fg-muted">{t("new.firstLinkHint")}</p>
          </div>
        </div>
      </Section>

      {formError ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {formError}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("new.submit")}
        cancelHref={cancelHref}
        cancelLabel={t("form.cancel")}
        pending={pending}
      />
    </form>
  );
}
