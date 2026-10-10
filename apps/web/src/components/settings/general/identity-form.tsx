"use client";

import { Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { FormAlert } from "@/components/auth/auth-parts";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { updateWorkspaceAction } from "@/server/actions/workspace";
import {
  isWorkspaceSlug,
  normalizeSlugInput,
  workspaceNameMaxLength,
  workspaceSlugMaxLength,
} from "../rules";
import { SettingsSection } from "../section";
import { SaveRow } from "../save-row";
import { settingsHref } from "../tabs";

export function WorkspaceIdentityForm({
  name,
  slug,
  host,
  canUpdate,
}: {
  name: string;
  slug: string;
  host: string;
  canUpdate: boolean;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const form = useAuthForm(
    { name, slug },
    (values) => ({
      name: !values.name.trim()
        ? t("general.validation.nameRequired")
        : values.name.trim().length > workspaceNameMaxLength
          ? t("general.validation.nameTooLong", {
              max: workspaceNameMaxLength,
            })
          : undefined,
      slug: isWorkspaceSlug(values.slug)
        ? undefined
        : t("general.validation.slugInvalid"),
    }),
    { fallbackError: t("common.errors.network") },
  );
  const dirty = form.values.name.trim() !== name || form.values.slug !== slug;

  const onSubmit = form.submit(async (values) => {
    const result = await updateWorkspaceAction(slug, {
      name: values.name.trim(),
      slug: values.slug,
    });
    if (!result.ok)
      switch (result.error) {
        case "slug_taken":
          return { field: "slug", error: t("general.errors.slugTaken") };
        case "invalid_slug":
          return { field: "slug", error: t("general.errors.slugInvalid") };
        case "forbidden":
          return { formError: t("common.errors.forbidden") };
        default:
          return { formError: t("common.errors.generic") };
      }
    if (result.data.slug !== slug) {
      router.replace(settingsHref(result.data.slug, "general"));
      return "navigating";
    }
    setSaved(true);
    router.refresh();
    return "done";
  });

  const edit = (field: "name" | "slug", value: string) => {
    setSaved(false);
    form.setValue(field, value);
  };

  return (
    <SettingsSection
      title={t("general.identity.title")}
      description={canUpdate ? undefined : t("general.identity.readOnly")}
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <AuthField
          id={form.id("name")}
          label={t("general.identity.name")}
          error={form.errorFor("name")}
        >
          {(control) => (
            <Input
              {...form.field("name")}
              {...control}
              onChange={(event) => edit("name", event.target.value)}
              disabled={!canUpdate}
              maxLength={workspaceNameMaxLength}
              autoComplete="organization"
            />
          )}
        </AuthField>
        <AuthField
          id={form.id("slug")}
          label={t("general.identity.slug")}
          error={form.errorFor("slug")}
          hint={t("general.identity.slugHint")}
        >
          {(control) => (
            <Input
              {...form.field("slug")}
              {...control}
              onChange={(event) =>
                edit("slug", normalizeSlugInput(event.target.value))
              }
              disabled={!canUpdate}
              maxLength={workspaceSlugMaxLength}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              leading={<span className="text-small">{host}/</span>}
            />
          )}
        </AuthField>
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
        <SaveRow
          saved={saved && !dirty}
          pending={form.pending}
          disabled={!dirty}
          {...(canUpdate
            ? {}
            : { disabledReason: t("general.identity.readOnly") })}
        />
      </form>
    </SettingsSection>
  );
}
