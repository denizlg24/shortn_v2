"use client";

import {
  Button,
  cn,
  Combobox,
  Field,
  Input,
  SheetBody,
  SheetFooter,
  Textarea,
} from "@shortn/ui";
import { KeyRound, Lock, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import type { PlanFeatures } from "@/lib/plan-features";
import { PlanGate } from "../plan-gate";
import { FormErrorText, type ErrorField, type FormError } from "./form-error";
import type { LinkDraft } from "./link-draft";
import { UtmEditor } from "./utm-editor";

export interface LinkFormProps {
  mode: "create" | "edit";
  initial: LinkDraft;
  /** The current password hint state of the link; null when it has no password. */
  protection: { hint: string | null } | null;
  domain: string;
  canEdit: boolean;
  features: PlanFeatures;
  allTags: string[];
  initialError?: FormError | null;
  onCancel: () => void;
  onSubmit: (draft: LinkDraft) => Promise<FormError | null>;
  /** Shown in the footer of an existing link; omitted while creating. */
  deleteAction?: { allowed: boolean; onDelete: () => void };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 border-t border-line pt-5"
    >
      <h3 id={headingId} className="text-small font-medium text-fg">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function LinkForm({
  mode,
  initial,
  protection,
  domain,
  canEdit,
  features,
  allTags,
  initialError = null,
  onCancel,
  onSubmit,
  deleteAction,
}: LinkFormProps) {
  const t = useTranslations("links.form");
  const tLinks = useTranslations("links");
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<FormError | null>(initialError);
  const [pending, setPending] = useState(false);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [changingPassword, setChangingPassword] = useState(false);
  const id = useId();
  const disabled = !canEdit || pending;
  const tagOptions = [...new Set([...allTags, ...extraTags, ...draft.tags])]
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => ({ value: tag, label: tag }));

  const edit = (patch: Partial<LinkDraft>, clears?: ErrorField) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (clears && error?.field === clears) setError(null);
  };
  const errorFor = (field: ErrorField) =>
    error?.field === field ? error : null;
  const errorNode = (field: ErrorField) => {
    const fieldError = errorFor(field);
    return fieldError ? <FormErrorText error={fieldError} /> : null;
  };

  const keyGate = features.customKeys.allowed ? null : features.customKeys;
  const passwordGate = features.passwords.allowed ? null : features.passwords;
  const utmGate = features.campaigns.allowed ? null : features.campaigns;
  const formError = errorFor("form");
  const showPasswordInputs =
    !draft.removePassword &&
    (protection === null || changingPassword) &&
    !passwordGate;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!canEdit || pending) return;
        setPending(true);
        const failure = await onSubmit(draft);
        setPending(false);
        setError(failure);
      }}
    >
      <SheetBody className="flex flex-col gap-5 pt-5">
        {canEdit ? null : (
          <p className="flex items-start gap-2 text-small text-fg-muted">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("readOnly")}
          </p>
        )}
        <Field label={t("destination")} htmlFor={`${id}-url`}>
          <Input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            required
            autoComplete="off"
            spellCheck={false}
            maxLength={2048}
            value={draft.url}
            disabled={disabled}
            aria-invalid={errorFor("url") ? true : undefined}
            onChange={(event) => edit({ url: event.target.value }, "url")}
            className="truncate"
          />
          {errorNode("url")}
        </Field>
        <Field label={t("key")} htmlFor={`${id}-key`}>
          <Input
            id={`${id}-key`}
            value={keyGate && mode === "create" ? "" : draft.key}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled || keyGate !== null}
            placeholder={mode === "create" ? t("keyPlaceholder") : undefined}
            aria-invalid={errorFor("key") ? true : undefined}
            leading={
              <span className="text-small text-fg-subtle">{domain}/</span>
            }
            frameClassName="gap-0"
            className="font-medium"
            onChange={(event) =>
              edit({ key: event.target.value.replace(/\s+/g, "-") }, "key")
            }
          />
          {errorNode("key") ??
            (keyGate ? (
              <PlanGate
                feature="customKeys"
                plan={keyGate.plan}
                className="text-meta"
              />
            ) : mode === "edit" ? (
              <p className="text-meta text-fg-muted">{t("keyHint")}</p>
            ) : null)}
        </Field>
        <Field label={t("title")} htmlFor={`${id}-title`}>
          <Input
            id={`${id}-title`}
            value={draft.title}
            maxLength={200}
            disabled={disabled}
            placeholder={t("titlePlaceholder")}
            onChange={(event) => edit({ title: event.target.value })}
          />
        </Field>
        <Field label={t("description")} htmlFor={`${id}-description`}>
          <Textarea
            id={`${id}-description`}
            value={draft.description}
            maxLength={500}
            rows={3}
            disabled={disabled}
            onChange={(event) => edit({ description: event.target.value })}
          />
        </Field>
        <Field label={t("tags")} htmlFor={`${id}-tags`}>
          <Combobox
            id={`${id}-tags`}
            multiple
            disabled={disabled}
            options={tagOptions}
            value={draft.tags}
            onValueChange={(tags) => edit({ tags: tags.slice(0, 50) })}
            placeholder={t("tagsPlaceholder")}
            searchPlaceholder={t("tagSearch")}
            emptyText={t("noTags")}
            createLabel={(tag) => t("createTag", { tag })}
            onCreate={(raw) => {
              const tag = raw.trim().replace(/\s+/g, " ").slice(0, 48);
              if (!tag) return;
              setExtraTags((current) => [...current, tag]);
              if (!draft.tags.includes(tag))
                edit({ tags: [...draft.tags, tag].slice(0, 50) });
            }}
          />
        </Field>

        <Section title={t("password")}>
          {protection && !changingPassword ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className={cn(
                  "flex items-center gap-2 text-small",
                  draft.removePassword ? "text-fg-muted" : "text-fg",
                )}
              >
                <KeyRound aria-hidden className="size-4 text-fg-subtle" />
                {draft.removePassword ? t("passwordRemoved") : t("passwordOn")}
              </p>
              <div className="flex items-center gap-1">
                {draft.removePassword ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => edit({ removePassword: false })}
                  >
                    {t("keepPassword")}
                  </Button>
                ) : (
                  <>
                    {passwordGate ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => setChangingPassword(true)}
                      >
                        {t("changePassword")}
                      </Button>
                    )}
                    <Button
                      variant="dangerGhost"
                      size="sm"
                      disabled={disabled}
                      onClick={() =>
                        edit({ removePassword: true, password: "" }, "password")
                      }
                    >
                      {t("removePassword")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : null}
          {passwordGate && !draft.removePassword ? (
            <PlanGate feature="passwords" plan={passwordGate.plan} />
          ) : null}
          {showPasswordInputs ? (
            <Field
              label={protection ? t("newPassword") : t("passwordLabel")}
              htmlFor={`${id}-password`}
            >
              <Input
                id={`${id}-password`}
                type="password"
                autoComplete="new-password"
                maxLength={128}
                value={draft.password}
                disabled={disabled}
                placeholder={protection ? undefined : t("passwordPlaceholder")}
                aria-invalid={errorFor("password") ? true : undefined}
                onChange={(event) =>
                  edit({ password: event.target.value }, "password")
                }
              />
            </Field>
          ) : null}
          {!draft.removePassword &&
          !passwordGate &&
          (protection !== null || draft.password) ? (
            <Field
              label={t("hint")}
              htmlFor={`${id}-hint`}
              hint={t("hintHelp")}
            >
              <Input
                id={`${id}-hint`}
                maxLength={100}
                value={draft.passwordHint}
                disabled={disabled}
                onChange={(event) => edit({ passwordHint: event.target.value })}
              />
            </Field>
          ) : null}
          {errorNode("password")}
        </Section>

        <Section title={t("utm")}>
          {utmGate ? (
            <PlanGate feature="campaigns" plan={utmGate.plan} />
          ) : (
            <UtmEditor
              value={draft.utm}
              onChange={(utm) => edit({ utm }, "utm")}
              disabled={disabled}
              invalid={errorFor("utm") !== null}
            />
          )}
          {errorNode("utm")}
        </Section>
      </SheetBody>
      <SheetFooter className="flex-wrap">
        {formError ? (
          <FormErrorText error={formError} className="basis-full pb-1" />
        ) : null}
        {deleteAction ? (
          <Button
            variant="dangerGhost"
            className="mr-auto"
            onClick={deleteAction.onDelete}
            {...(deleteAction.allowed
              ? {}
              : {
                  disabledReason: canEdit
                    ? tLinks("deleteReason")
                    : tLinks("viewerReason"),
                })}
          >
            <Trash aria-hidden />
            {t("delete")}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onCancel}>
          {mode === "create" ? t("cancel") : t("discard")}
        </Button>
        <Button
          variant="primary"
          type="submit"
          loading={pending}
          {...(canEdit ? {} : { disabledReason: tLinks("viewerReason") })}
        >
          {mode === "create" ? tLinks("create") : t("save")}
        </Button>
      </SheetFooter>
    </form>
  );
}
