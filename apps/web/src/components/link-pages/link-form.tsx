"use client";

import type { PlanId } from "@shortn/billing";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@shortn/ui";
import { useLinkCreation } from "./use-link-creation";
import { useFormSubmit } from "../editor/use-form-submit";
import { TagsField, type TagOption } from "../page/tags-field";
import { Section } from "../page/page";
import { FormActions, FormField, inputClass } from "../page/form";
import { PlanGate } from "../plan-gate";
import type { FormState } from "@/server/actions/link-pages";
import type { LinkFormValues } from "./link-form-values";
import { LinkAdvancedFields } from "./link-advanced-fields";

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
  workspace,
}: {
  mode: "create" | "edit";
  domain: string;
  initial: LinkFormValues;
  allTags: TagOption[];
  // Cheapest plan with the feature, or null when this workspace has it.
  gates: { customKeys: PlanId | null; passwords: PlanId | null };
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
  workspace?: string;
}) {
  const t = useTranslations("linkPages.form");
  const advanced = useTranslations("linkAdvanced");
  const creation = useTranslations("linkCreation");
  const tErrors = useTranslations("linkPages.errors");
  const tLinkErrors = useTranslations("links.errors");
  const { state, pending, onSubmit } = useFormSubmit(action);
  const router = useRouter(),
    copiedResult = useRef(""),
    mounted = useRef(true),
    submitted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!pending && !state.created) submitted.current = false;
  }, [pending, state]);
  const [url, setUrl] = useState(initial.url),
    [title, setTitle] = useState(initial.title),
    [key, setKey] = useState(initial.key);
  const [titleEdited, setTitleEdited] = useState(false),
    [keyEdited, setKeyEdited] = useState(false);
  const { lookup, retry } = useLinkCreation(
    mode === "create" ? workspace : undefined,
    url,
  );
  const shownTitle =
    mode === "create" && !titleEdited ? (lookup.title ?? title) : title;
  const shownKey =
    mode === "create" && !keyEdited && !gates.customKeys
      ? (lookup.key ?? key)
      : key;
  useEffect(() => {
    const created = state.created;
    if (!created || copiedResult.current === created.id) return;
    copiedResult.current = created.id;
    void (async () => {
      let copied = false,
        timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          navigator.clipboard.writeText(created.url),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error("clipboard_timeout")),
              1500,
            );
          }),
        ]);
        copied = true;
      } catch {
        /* The overview offers its existing copy button when automatic copy is denied. */
      } finally {
        clearTimeout(timeout);
      }
      if (mounted.current)
        router.push(`${created.path}?created=1&copied=${copied ? "1" : "0"}`);
    })();
  }, [state.created, router]);
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
        return tLinkErrors("keyReserved", {
          key: String(state.detail?.key ?? ""),
        });
      case "key_taken":
        return tLinkErrors("keyTaken", {
          key: String(state.detail?.key ?? ""),
        });
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
    <form
      onSubmit={(event) => {
        if (submitted.current || pending || state.created)
          event.preventDefault();
        else {
          submitted.current = true;
          onSubmit(event);
        }
      }}
      noValidate
    >
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
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            autoFocus={mode === "create"}
            aria-invalid={Boolean(fieldError("url"))}
            aria-describedby={describe("url", true)}
            className={inputClass}
          />
        </FormField>
        {mode === "create" ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p role="status" className="text-meta text-fg-muted">
              {creation(lookup.phase)}
            </p>
            {lookup.phase === "unavailable" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={retry}
                disabled={pending}
              >
                {creation("retry")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Section>

      <Section title={t("keySection")} anchor="link-key">
        <FormField
          id={`${id}-key`}
          label={t("key")}
          {...(gates.customKeys
            ? {}
            : {
                optional: t("optional"),
                hint: mode === "edit" ? t("keyRenamed") : t("keyHint"),
              })}
          error={fieldError("key")}
        >
          <div className="flex items-stretch">
            <span className="flex items-center rounded-l-control border border-r-0 border-line-strong bg-bg-subtle px-3 text-body text-fg-muted">
              {domain}/
            </span>
            {gates.customKeys ? (
              <input
                id={`${id}-key`}
                value={mode === "edit" ? key : ""}
                placeholder={mode === "edit" ? undefined : t("keyRandom")}
                disabled
                aria-describedby={`${id}-key-gate`}
                className={`${inputClass} rounded-l-none disabled:cursor-not-allowed disabled:opacity-50`}
                readOnly
              />
            ) : (
              <input
                id={`${id}-key`}
                name="key"
                value={shownKey}
                onChange={(event) => {
                  setKeyEdited(true);
                  setKey(event.target.value);
                }}
                maxLength={64}
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={Boolean(fieldError("key"))}
                aria-describedby={describe("key", true)}
                className={`${inputClass} rounded-l-none`}
              />
            )}
          </div>
          {mode === "create" && !gates.customKeys && keyEdited && lookup.key ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setKey(lookup.key!);
                setKeyEdited(false);
              }}
            >
              {creation("useKey")}
            </Button>
          ) : null}
        </FormField>
        {gates.customKeys ? (
          <PlanGate
            id={`${id}-key-gate`}
            feature="customKeys"
            plan={gates.customKeys}
            className="mt-3"
          />
        ) : null}
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
              value={shownTitle}
              onChange={(event) => {
                setTitleEdited(true);
                setTitle(event.target.value);
              }}
              maxLength={200}
              className={inputClass}
            />
            {mode === "create" && titleEdited && lookup.title ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTitle(lookup.title!);
                  setTitleEdited(false);
                }}
              >
                {creation("useTitle")}
              </Button>
            ) : null}
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
        <TagsField
          id={`${id}-tags`}
          allTags={allTags}
          selected={initial.tags}
          label={t("tagsSection")}
        />
      </Section>

      <Section title={t("passwordSection")} anchor="link-password">
        {gates.passwords ? (
          <div className="flex flex-col gap-3">
            <FormField id={`${id}-password`} label={t("password")}>
              <input
                id={`${id}-password`}
                type="password"
                disabled
                aria-describedby={`${id}-password-gate`}
                className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              />
            </FormField>
            <PlanGate
              id={`${id}-password-gate`}
              feature="passwords"
              plan={gates.passwords}
            />
          </div>
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

      <Section title={advanced("title")} anchor="link-advanced">
        <LinkAdvancedFields
          {...(initial.rules ? { initial: initial.rules } : {})}
          {...(initial.og ? { preview: initial.og } : {})}
          pending={pending}
          error={Boolean(
            state.error && (state.field === "rules" || state.field === "og"),
          )}
        />
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
        pending={pending || Boolean(state.created)}
      />
    </form>
  );
}
