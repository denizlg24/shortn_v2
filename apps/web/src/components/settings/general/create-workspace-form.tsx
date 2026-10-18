"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { FormActions, FormField, inputClass } from "@/components/page/form";
import { Notice } from "@/components/page/notice";
import { createWorkspacePageAction } from "@/server/actions/settings-pages";
import {
  normalizeSlugInput,
  slugFromName,
  workspaceNameMaxLength,
  workspaceSlugMaxLength,
} from "../rules";
import { useWorkspaceError } from "./use-workspace-error";

export function CreateWorkspaceForm({
  host,
  plansHref,
  cancelHref,
}: {
  host: string;
  /** Extra workspaces come with the personal workspace's plan. */
  plansHref: string | null;
  cancelHref: string;
}) {
  const t = useTranslations("settings.create");
  const message = useWorkspaceError();
  const [state, formAction, pending] = useActionState(
    createWorkspacePageAction,
    { error: null },
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const id = useId();
  const fieldError = (field: string) =>
    state.error && state.field === field ? message(state.error) : undefined;
  const limit = Number(state.detail?.limit ?? 1);

  return (
    <form action={formAction} noValidate className="text-left">
      <div className="flex flex-col gap-4">
        <FormField
          id={`${id}-name`}
          label={t("name")}
          error={fieldError("name")}
        >
          <input
            id={`${id}-name`}
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugEdited) setSlug(slugFromName(event.target.value));
            }}
            placeholder={t("namePlaceholder")}
            maxLength={workspaceNameMaxLength}
            autoComplete="off"
            autoFocus
            aria-invalid={Boolean(fieldError("name"))}
            className={inputClass}
          />
        </FormField>
        <FormField
          id={`${id}-slug`}
          label={t("slug")}
          hint={t("slugHint", { host })}
          error={fieldError("slug")}
        >
          <input
            id={`${id}-slug`}
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(normalizeSlugInput(event.target.value));
            }}
            maxLength={workspaceSlugMaxLength}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(fieldError("slug"))}
            aria-describedby={`${id}-slug-${fieldError("slug") ? "error" : "hint"}`}
            className={`${inputClass} font-mono`}
          />
        </FormField>
      </div>
      {state.error === "limit_reached" ? (
        <div className="mt-5">
          <Notice tone="warning">
            {t("limitReached", { limit })}{" "}
            {plansHref ? (
              <Link
                href={plansHref}
                className="font-medium text-signal hover:underline"
              >
                {t("seePlans")}
              </Link>
            ) : null}
          </Notice>
        </div>
      ) : state.error && !state.field ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {message(state.error)}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("submit")}
        cancelHref={cancelHref}
        cancelLabel={t("cancel")}
        pending={pending}
      />
    </form>
  );
}
