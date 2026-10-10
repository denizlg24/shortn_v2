"use client";

import { Button, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { FormAlert } from "@/components/auth/auth-parts";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { createWorkspaceAction } from "@/server/actions/workspace";
import {
  isWorkspaceSlug,
  normalizeSlugInput,
  slugFromName,
  workspaceNameMaxLength,
  workspaceSlugMaxLength,
} from "../rules";
import { Notice, SettingsSection, textAction } from "../section";
import { settingsHref } from "../tabs";

export function CreateWorkspace({
  host,
  personalSlug,
}: {
  host: string;
  /** Extra workspaces are an entitlement of the personal workspace's plan. */
  personalSlug: string | null;
}) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  return (
    <SettingsSection
      title={t("general.create.title")}
      description={t("general.create.description")}
      aside={
        open ? null : (
          <Button onClick={() => setOpen(true)}>
            {t("general.create.open")}
          </Button>
        )
      }
    >
      {open ? (
        <CreateWorkspaceForm
          host={host}
          personalSlug={personalSlug}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </SettingsSection>
  );
}

function CreateWorkspaceForm({
  host,
  personalSlug,
  onCancel,
}: {
  host: string;
  personalSlug: string | null;
  onCancel: () => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [slugEdited, setSlugEdited] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const form = useAuthForm(
    { name: "", slug: "" },
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

  const onSubmit = form.submit(async (values) => {
    setLimit(null);
    const result = await createWorkspaceAction({
      name: values.name.trim(),
      slug: values.slug,
    });
    if (result.ok) {
      router.push(settingsHref(result.data.slug, "members"));
      return "navigating";
    }
    switch (result.error) {
      case "limit_reached": {
        const max = result.detail?.limit;
        setLimit(typeof max === "number" ? max : 1);
        return "done";
      }
      case "slug_taken":
        return { field: "slug", error: t("general.errors.slugTaken") };
      case "invalid_slug":
        return { field: "slug", error: t("general.errors.slugInvalid") };
      default:
        return { formError: t("common.errors.generic") };
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <AuthField
        id={form.id("name")}
        label={t("general.create.name")}
        error={form.errorFor("name")}
      >
        {(control) => (
          <Input
            {...form.field("name")}
            {...control}
            onChange={(event) => {
              const name = event.target.value;
              form.setValue("name", name);
              if (!slugEdited) form.setValue("slug", slugFromName(name));
            }}
            placeholder={t("general.create.namePlaceholder")}
            maxLength={workspaceNameMaxLength}
            autoComplete="off"
            autoFocus
          />
        )}
      </AuthField>
      <AuthField
        id={form.id("slug")}
        label={t("general.create.slug")}
        error={form.errorFor("slug")}
      >
        {(control) => (
          <Input
            {...form.field("slug")}
            {...control}
            onChange={(event) => {
              setSlugEdited(true);
              form.setValue("slug", normalizeSlugInput(event.target.value));
            }}
            maxLength={workspaceSlugMaxLength}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            leading={<span className="text-small">{host}/</span>}
          />
        )}
      </AuthField>
      {limit !== null ? (
        <Notice
          tone="warning"
          live="alert"
          action={
            personalSlug ? (
              <Link
                href={settingsHref(personalSlug, "billing")}
                className={textAction}
              >
                {t("common.seePlans")}
              </Link>
            ) : null
          }
        >
          {t("general.create.limitReached", { limit })}
        </Notice>
      ) : null}
      {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" loading={form.pending}>
          {t("general.create.submit")}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={form.pending}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
