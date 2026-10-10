"use client";

import { authClient } from "@shortn/auth/client";
import { Button } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { AuthField } from "@/components/auth/auth-field";
import { AuthHeading, FormAlert } from "@/components/auth/auth-parts";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { PasswordInput } from "@/components/auth/password-input";
import {
  meetsPasswordPolicy,
  passwordMaxLength,
  serverPasswordMinLength,
} from "@/components/auth/rules";
import { useAuthForm } from "@/components/auth/use-auth-form";

type Stage = "form" | "done" | "invalid";

export function ResetForm({ token }: { token: string | null }) {
  const t = useTranslations("auth");
  const [stage, setStage] = useState<Stage>(token ? "form" : "invalid");
  const headingId = useId();
  const form = useAuthForm(
    { password: "", confirm: "" },
    (values) => ({
      password: !values.password
        ? t("validation.passwordRequired")
        : meetsPasswordPolicy(values.password)
          ? undefined
          : t("validation.passwordPolicy"),
      confirm: !values.confirm
        ? t("validation.confirmRequired")
        : values.confirm === values.password
          ? undefined
          : t("validation.passwordMismatch"),
    }),
    { fallbackError: t("errors.network") },
  );
  const passwordError = form.errorFor("password");

  const showStage = (next: Stage) => {
    flushSync(() => setStage(next));
    document.getElementById(headingId)?.focus();
  };

  const onSubmit = form.submit(async (values) => {
    if (!token) return "done";
    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });
    if (!error) {
      showStage("done");
      return "done";
    }
    switch (error.code) {
      case "INVALID_TOKEN":
        showStage("invalid");
        return "done";
      case "PASSWORD_TOO_SHORT":
        return {
          field: "password",
          error: t("errors.passwordTooShort", { min: serverPasswordMinLength }),
        };
      case "PASSWORD_TOO_LONG":
        return {
          field: "password",
          error: t("errors.passwordTooLong", { max: passwordMaxLength }),
        };
    }
    return {
      formError:
        error.status === 429
          ? t("errors.tooManyAttempts")
          : t("errors.generic"),
    };
  });

  if (stage === "invalid")
    return (
      <>
        <AuthHeading
          id={headingId}
          title={t("reset.invalidTitle")}
          description={t("reset.invalidBody")}
        />
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href="/recover">{t("reset.requestNew")}</Link>
        </Button>
      </>
    );

  if (stage === "done")
    return (
      <>
        <AuthHeading
          id={headingId}
          title={t("reset.doneTitle")}
          description={t("reset.doneBody")}
        />
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href="/login">{t("reset.login")}</Link>
        </Button>
      </>
    );

  return (
    <>
      <AuthHeading
        title={t("reset.title")}
        description={t("reset.description")}
      />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <AuthField
          id={form.id("password")}
          label={t("fields.newPassword")}
          error={passwordError}
          describedBy={`${form.id("password")}-rules`}
          after={
            <PasswordChecklist
              id={`${form.id("password")}-rules`}
              password={form.values.password}
              flagUnmet={Boolean(passwordError)}
            />
          }
        >
          {(control) => (
            <PasswordInput
              {...form.field("password")}
              {...control}
              size="lg"
              autoFocus
              autoComplete="new-password"
            />
          )}
        </AuthField>
        <AuthField
          id={form.id("confirm")}
          label={t("fields.confirmPassword")}
          error={form.errorFor("confirm")}
        >
          {(control) => (
            <PasswordInput
              {...form.field("confirm")}
              {...control}
              size="lg"
              autoComplete="new-password"
            />
          )}
        </AuthField>
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-1 w-full"
          loading={form.pending}
        >
          {t("reset.submit")}
        </Button>
      </form>
    </>
  );
}
