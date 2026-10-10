"use client";

import type { PlanId } from "@shortn/billing";
import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { Section } from "../page/page";
import { FormActions, FormField, inputClass } from "../page/form";
import { PlanGate } from "../plan-gate";
import type { FormState } from "@/server/actions/link-pages";
import type { LinkFormValues } from "./link-form-values";

// One form for /links/new and /links/{id}/edit: native fields posted to a
// server action, which redirects on success (17).
export function LinkForm({
  mode,
  domain,
  initial,
  allTags,
  gates,
  action,
  cancelHref,
}: {
  mode: "create" | "edit";
  domain: string;
  initial: LinkFormValues;
  allTags: string[];
  // Cheapest plan with the feature, or null when this workspace has it.
  gates: { customKeys: PlanId | null; passwords: PlanId | null };
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("linkPages.form");
  const tErrors = useTranslations("linkPages.errors");
  const tLinkErrors = useTranslations("links.errors");
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [passwordMode, setPasswordMode] = useState<"keep" | "set" | "remove">(
    "keep",
  );
  const id = useId();

  const message = (code: string) => {
    switch (code) {
      case "url_required":
      case "utm_empty":
        return tErrors(code);
      case "limit_reached":
        return tErrors("limit_reached", {
          limit: Number(state.detail?.limit ?? 0),
        });
      case "feature_required":
        return tErrors("feature_required");
      case "invalid_url":
        return tLinkErrors("invalidUrl");
      case "unsafe_destination":
        return tLinkErrors("unsafeDestination");
      case "invalid_key":
        return tLinkErrors("invalidKey");
      case "key_reserved":
        return tLinkErrors("keyReserved");
      case "key_taken":
        return tLinkErrors("keyTaken");
      case "forbidden":
        return tLinkErrors("forbidden");
      case "not_found":
        return tLinkErrors("notFound");
      default:
        return tLinkErrors("generic");
    }
  };
  const fieldError = (field: string) =>
    state.error && state.field === field ? message(state.error) : undefined;
  const formError = state.error && !state.field ? message(state.error) : null;
  const describe = (field: string, hint: boolean) =>
    fieldError(field)
      ? `${id}-${field}-error`
      : hint
        ? `${id}-${field}-hint`
        : undefined;

  return (
    <form action={formAction} noValidate>
      <Section title={t("destinationSection")}>
        <FormField
          id={`${id}-url`}
          label={t("url")}
          hint={t("urlHint")}
          error={fieldError("url")}
        >
          <input
            id={`${id}-url`}
            name="url"
            type="url"
            inputMode="url"
            required
            defaultValue={initial.url}
            placeholder="https://"
            autoFocus={mode === "create"}
            aria-invalid={Boolean(fieldError("url"))}
            aria-describedby={describe("url", true)}
            className={inputClass}
          />
        </FormField>
      </Section>

      <Section title={t("keySection")}>
        {gates.customKeys ? (
          <PlanGate feature="customKeys" plan={gates.customKeys} />
        ) : (
          <FormField
            id={`${id}-key`}
            label={t("key")}
            optional={t("optional")}
            hint={mode === "edit" ? t("keyRenamed") : t("keyHint")}
            error={fieldError("key")}
          >
            <div className="flex items-stretch">
              <span className="flex items-center rounded-l-control border border-r-0 border-line-strong bg-bg-subtle px-3 text-body text-fg-muted">
                {domain}/
              </span>
              <input
                id={`${id}-key`}
                name="key"
                defaultValue={initial.key}
                maxLength={64}
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={Boolean(fieldError("key"))}
                aria-describedby={describe("key", true)}
                className={`${inputClass} rounded-l-none`}
              />
            </div>
          </FormField>
        )}
      </Section>

      <Section title={t("detailsSection")}>
        <div className="flex flex-col gap-4">
          <FormField
            id={`${id}-title`}
            label={t("title")}
            optional={t("optional")}
          >
            <input
              id={`${id}-title`}
              name="title"
              defaultValue={initial.title}
              maxLength={200}
              className={inputClass}
            />
          </FormField>
          <FormField
            id={`${id}-description`}
            label={t("description")}
            optional={t("optional")}
          >
            <textarea
              id={`${id}-description`}
              name="description"
              defaultValue={initial.description}
              maxLength={500}
              rows={3}
              className={`${inputClass} h-auto py-2`}
            />
          </FormField>
        </div>
      </Section>

      <Section title={t("tagsSection")}>
        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">{t("tagsSection")}</legend>
          {allTags.length ? (
            <div>
              <p className="mb-2 text-small font-medium">{t("existingTags")}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {allTags.map((tag) => (
                  <label
                    key={tag}
                    className="flex items-center gap-2 text-small"
                  >
                    <input
                      type="checkbox"
                      name="tag"
                      value={tag}
                      defaultChecked={initial.tags.includes(tag)}
                      className="size-4 accent-[var(--color-signal)]"
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-small text-fg-muted">{t("noTags")}</p>
          )}
          <FormField
            id={`${id}-newTags`}
            label={t("newTags")}
            optional={t("optional")}
            hint={t("newTagsHint")}
          >
            <input
              id={`${id}-newTags`}
              name="newTags"
              className={inputClass}
              aria-describedby={`${id}-newTags-hint`}
            />
          </FormField>
        </fieldset>
      </Section>

      <Section title={t("passwordSection")}>
        {gates.passwords ? (
          <PlanGate feature="passwords" plan={gates.passwords} />
        ) : (
          <div className="flex flex-col gap-4">
            {mode === "edit" && initial.hasPassword ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{t("passwordSection")}</legend>
                {(["keep", "set", "remove"] as const).map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2 text-small"
                  >
                    <input
                      type="radio"
                      name="passwordMode"
                      value={option}
                      checked={passwordMode === option}
                      onChange={() => setPasswordMode(option)}
                      className="size-4 accent-[var(--color-signal)]"
                    />
                    {t(
                      option === "keep"
                        ? "passwordKeep"
                        : option === "set"
                          ? "passwordSet"
                          : "passwordRemove",
                    )}
                  </label>
                ))}
              </fieldset>
            ) : (
              <input type="hidden" name="passwordMode" value="set" />
            )}
            {!initial.hasPassword || passwordMode === "set" ? (
              <FormField
                id={`${id}-password`}
                label={t("password")}
                optional={t("optional")}
              >
                <input
                  id={`${id}-password`}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  className={inputClass}
                />
              </FormField>
            ) : null}
            {passwordMode !== "remove" ? (
              <FormField
                id={`${id}-passwordHint`}
                label={t("passwordHint")}
                hint={t("passwordHintHelp")}
              >
                <input
                  id={`${id}-passwordHint`}
                  name="passwordHint"
                  defaultValue={initial.passwordHint}
                  maxLength={100}
                  aria-describedby={`${id}-passwordHint-hint`}
                  className={inputClass}
                />
              </FormField>
            ) : null}
          </div>
        )}
      </Section>

      {formError ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {formError}
        </p>
      ) : null}
      <FormActions
        submitLabel={mode === "create" ? t("create") : t("save")}
        cancelHref={cancelHref}
        cancelLabel={t("cancel")}
        pending={pending}
      />
    </form>
  );
}
