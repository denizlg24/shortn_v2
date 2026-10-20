"use client";

import type { TagColor } from "@shortn/core/tag-options";
import { Combobox } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import type { FormState } from "@/server/actions/link-pages";
import { tagTargetsAction } from "@/server/actions/tags";
import { useFormSubmit } from "../editor/use-form-submit";
import { ConfirmDelete } from "../page/confirm-delete";
import { FormActions, FormField, inputClass } from "../page/form";
import { TagChip } from "./tag-chip";
import { TagColorSwatches } from "./tag-color-picker";

const knownErrors = [
  "forbidden",
  "not_found",
  "name_taken",
  "invalid_input",
  "target_required",
] as const;
const isKnownError = (code: string): code is (typeof knownErrors)[number] =>
  (knownErrors as readonly string[]).includes(code);

function useTagErrorMessage() {
  const t = useTranslations("tags.errors");
  return (code: string) => (isKnownError(code) ? t(code) : t("failed"));
}

export function EditTagForm({
  initial,
  action,
  cancelHref,
}: {
  initial: { name: string; color: TagColor };
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("tags.editPage");
  const message = useTagErrorMessage();
  const { state, pending, onSubmit } = useFormSubmit(action);
  const [color, setColor] = useState(initial.color);
  const id = useId();
  const nameError =
    state.error && state.field === "name" ? message(state.error) : undefined;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormField
        id={`${id}-name`}
        label={t("name")}
        hint={t("nameHint")}
        error={nameError}
      >
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={48}
          defaultValue={initial.name}
          aria-invalid={Boolean(nameError) || undefined}
          aria-describedby={nameError ? `${id}-name-error` : `${id}-name-hint`}
          className={inputClass}
        />
      </FormField>
      <div className="flex flex-col gap-2">
        <span className="text-small font-medium">{t("color")}</span>
        <TagColorSwatches
          name="color"
          legend={t("color")}
          value={color}
          onChange={setColor}
        />
      </div>
      {state.error && !state.field ? (
        <p role="alert" className="text-small text-danger">
          {message(state.error)}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("save")}
        cancelHref={cancelHref}
        cancelLabel={t("cancel")}
        pending={pending}
      />
    </form>
  );
}

export function MergeTagForm({
  workspace,
  tag,
  usage,
  action,
  cancelHref,
}: {
  workspace: string;
  tag: { id: string; name: string; color: TagColor };
  usage: { links: number; qrCodes: number };
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const t = useTranslations("tags.mergePage");
  const editText = useTranslations("tags.editPage");
  const message = useTagErrorMessage();
  const [missing, setMissing] = useState(false);
  const [target, setTarget] = useState<{
    id: string;
    name: string;
    color: TagColor;
  } | null>(null);
  const { state, pending, onSubmit } = useFormSubmit(action, () => {
    setMissing(!target);
    return Boolean(target);
  });
  const id = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<
    { id: string; name: string; color: TagColor }[]
  >([]);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () => {
        tagTargetsAction(workspace, { search: query, exclude: tag.id })
          .then((items) => {
            if (live) setOptions(items);
          })
          .catch(() => {
            if (live) setOptions([]);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [workspace, query, tag.id]);
  const choices =
    target && !options.some((item) => item.id === target.id)
      ? [target, ...options]
      : options;
  const targetError =
    missing && !target
      ? message("target_required")
      : state.error && state.field === "target"
        ? message(state.error)
        : undefined;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="target" value={target?.id ?? ""} />
      <FormField id={`${id}-target`} label={t("target")} error={targetError}>
        <Combobox
          id={`${id}-target`}
          options={choices.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          value={target ? [target.id] : []}
          onValueChange={(value) =>
            setTarget(choices.find((item) => item.id === value[0]) ?? null)
          }
          onSearchChange={setQuery}
          placeholder={t("targetPlaceholder")}
          searchPlaceholder={t("targetSearch")}
          emptyText={t("targetEmpty")}
          invalid={Boolean(targetError)}
          className="h-9 text-body"
        />
      </FormField>
      <div>
        <p className="mb-2 flex flex-wrap items-center gap-2 text-small">
          <TagChip name={tag.name} color={tag.color} />
          <span aria-hidden className="text-fg-subtle">
            →
          </span>
          {target ? (
            <TagChip name={target.name} color={target.color} />
          ) : (
            <span className="text-fg-subtle">{t("targetPlaceholder")}</span>
          )}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-small text-fg-muted">
          <li>
            {t("consequences.move", {
              links: usage.links,
              qrCodes: usage.qrCodes,
              tag: tag.name,
            })}
          </li>
          <li>{t("consequences.remove", { tag: tag.name })}</li>
          <li>{t("consequences.final")}</li>
        </ul>
      </div>
      {state.error && !state.field ? (
        <p role="alert" className="text-small text-danger">
          {message(state.error)}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("confirm")}
        cancelHref={cancelHref}
        cancelLabel={editText("cancel")}
        pending={pending}
        tone="danger"
      />
    </form>
  );
}

export function DeleteTag({
  tag,
  usage,
  action,
  cancelHref,
}: {
  tag: { name: string; color: TagColor };
  usage: { links: number; qrCodes: number };
  action: (state: {
    error: string | null;
  }) => Promise<{ error: string | null }>;
  cancelHref: string;
}) {
  const t = useTranslations("tags.deletePage");
  const message = useTagErrorMessage();
  return (
    <ConfirmDelete
      items={[<TagChip key="tag" name={tag.name} color={tag.color} />]}
      consequences={[
        t("consequences.remove", {
          tag: tag.name,
          links: usage.links,
          qrCodes: usage.qrCodes,
        }),
        t("consequences.keep"),
        t("consequences.final"),
      ]}
      action={action}
      confirmLabel={t("confirm")}
      cancelHref={cancelHref}
      errorMessage={message}
    />
  );
}
