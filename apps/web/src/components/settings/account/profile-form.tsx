"use client";

import { authClient } from "@shortn/auth/client";
import { Input } from "@shortn/ui";
import { AtSign } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { FormAlert } from "@/components/auth/auth-parts";
import {
  nameMaxLength,
  normalizeUsername,
  usernameIssue,
  usernameMaxLength,
  usernameMinLength,
} from "@/components/auth/rules";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { ImageUpload, useUploadStatus } from "@/components/page/image-upload";
import { SaveRow } from "../save-row";
import { SettingsSection } from "../section";
interface AccountUser {
  name: string;
  username: string;
  image: string;
  email: string;
  emailVerified: boolean;
}

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export function ProfileForm({ user }: { user: AccountUser }) {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const uploads = useUploadStatus();
  const initial = {
    name: user.name,
    username: user.username,
    image: user.image,
  };
  const form = useAuthForm(
    initial,
    (values) => {
      // Legacy accounts may hold usernames today's rules reject; only a
      // changed one is checked.
      const issue =
        values.username === user.username
          ? null
          : usernameIssue(values.username);
      return {
        name: !values.name.trim()
          ? tAuth("validation.nameRequired")
          : values.name.trim().length > nameMaxLength
            ? tAuth("validation.nameTooLong", { max: nameMaxLength })
            : undefined,
        username:
          issue === "required"
            ? tAuth("validation.usernameRequired")
            : issue === "length"
              ? tAuth("validation.usernameLength", {
                  min: usernameMinLength,
                  max: usernameMaxLength,
                })
              : issue === "format"
                ? tAuth("validation.usernameFormat")
                : issue === "digits"
                  ? tAuth("validation.usernameDigits")
                  : undefined,
        image:
          values.image.trim() && !isHttpUrl(values.image.trim())
            ? t("account.profile.imageInvalid")
            : undefined,
      };
    },
    { fallbackError: t("common.errors.network") },
  );
  const dirty =
    form.values.name.trim() !== user.name ||
    form.values.username !== user.username ||
    form.values.image.trim() !== user.image;

  const onSubmit = form.submit(async (values) => {
    const image = values.image.trim();
    const { error } = await authClient.updateUser({
      name: values.name.trim(),
      image: image || null,
      ...(values.username !== user.username
        ? { username: values.username }
        : {}),
    });
    if (!error) {
      setSaved(true);
      router.refresh();
      return "done";
    }
    switch (error.code) {
      case "USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER":
        return { field: "username", error: tAuth("errors.usernameTaken") };
      case "USERNAME_TOO_SHORT":
      case "USERNAME_IS_TOO_LONG":
      case "USERNAME_IS_INVALID":
        return { field: "username", error: tAuth("errors.usernameInvalid") };
    }
    return {
      formError:
        error.status === 429
          ? tAuth("errors.tooManyAttempts")
          : t("common.errors.generic"),
    };
  });

  const edit = (field: "name" | "username" | "image", value: string) => {
    setSaved(false);
    form.setValue(field, value);
  };

  return (
    <SettingsSection
      title={t("account.profile.title")}
      description={t("account.profile.description")}
    >
      <form
        noValidate
        onSubmit={(event) => {
          if (uploads.uploading) event.preventDefault();
          else onSubmit(event);
        }}
        className="flex flex-col gap-4"
      >
        <AuthField
          id={form.id("name")}
          label={tAuth("fields.name")}
          error={form.errorFor("name")}
        >
          {(control) => (
            <Input
              {...form.field("name")}
              {...control}
              onChange={(event) => edit("name", event.target.value)}
              maxLength={nameMaxLength}
              autoComplete="name"
            />
          )}
        </AuthField>
        <AuthField
          id={form.id("username")}
          label={tAuth("fields.username")}
          error={form.errorFor("username")}
          hint={tAuth("fields.usernameHint")}
        >
          {(control) => (
            <Input
              {...form.field("username")}
              {...control}
              onChange={(event) =>
                edit("username", normalizeUsername(event.target.value))
              }
              maxLength={usernameMaxLength}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              leading={<AtSign aria-hidden />}
            />
          )}
        </AuthField>
        <AuthField
          id={form.id("image")}
          label={t("account.profile.image")}
          error={form.errorFor("image")}
          hint={t("account.profile.imageHint")}
        >
          {(control) => (
            <ImageUpload
              id={control.id}
              label={t("account.profile.image")}
              value={form.values.image}
              purpose="avatar"
              onChange={(url) => edit("image", url)}
              onBusyChange={uploads.onBusyChange}
            />
          )}
        </AuthField>
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
        <SaveRow
          saved={saved && !dirty}
          pending={form.pending || uploads.uploading}
          disabled={!dirty}
        />
      </form>
    </SettingsSection>
  );
}
