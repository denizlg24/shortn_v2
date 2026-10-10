"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/auth-field";
import {
  AuthHeading,
  AuthPrompt,
  FormAlert,
  OrDivider,
} from "@/components/auth/auth-parts";
import type { OAuthFailure } from "@/components/auth/oauth-failure";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { PasswordInput } from "@/components/auth/password-input";
import {
  isEmail,
  meetsPasswordPolicy,
  nameMaxLength,
  normalizeUsername,
  passwordMaxLength,
  serverPasswordMinLength,
  serverUsernameMinLength,
  usernameIssue,
  usernameMaxLength,
  usernameMinLength,
} from "@/components/auth/rules";
import {
  hasSocialSignIn,
  SocialSignIn,
  type EnabledProviders,
} from "@/components/auth/social-sign-in";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { useOAuthFailureMessage } from "@/components/auth/use-oauth-failure-message";
import { rememberVerifyEmail } from "@/components/auth/verify-email-cookie";

export function RegisterForm({
  oauthFailure,
  providers,
  next,
}: {
  oauthFailure: OAuthFailure;
  providers: EnabledProviders;
  next: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const oauthMessage = useOAuthFailureMessage(oauthFailure);

  const usernameMessage = (username: string) => {
    switch (usernameIssue(username)) {
      case "required":
        return t("validation.usernameRequired");
      case "length":
        return t("validation.usernameLength", {
          min: usernameMinLength,
          max: usernameMaxLength,
        });
      case "format":
        return t("validation.usernameFormat");
      case "digits":
        return t("validation.usernameDigits");
      case null:
        return undefined;
    }
  };

  const form = useAuthForm(
    { name: "", username: "", email: "", password: "", confirm: "" },
    (values) => {
      const name = values.name.trim();
      const email = values.email.trim();
      return {
        name: !name
          ? t("validation.nameRequired")
          : name.length > nameMaxLength
            ? t("validation.nameTooLong", { max: nameMaxLength })
            : undefined,
        username: usernameMessage(values.username),
        email: !email
          ? t("validation.emailRequired")
          : isEmail(email)
            ? undefined
            : t("validation.emailInvalid"),
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
      };
    },
    { fallbackError: t("errors.network"), initialFormError: oauthMessage },
  );
  const passwordError = form.errorFor("password");

  const onSubmit = form.submit(async (values) => {
    const email = values.email.trim();
    const { error } = await authClient.signUp.email({
      name: values.name.trim(),
      username: values.username,
      email,
      password: values.password,
      // Verification signs the user in and lands on /verify, which forwards
      // to `next` (an invite they signed up for).
      callbackURL:
        next === "/" ? "/verify" : `/verify?next=${encodeURIComponent(next)}`,
    });
    if (!error) {
      rememberVerifyEmail(email);
      router.push("/verify");
      return "navigating";
    }

    switch (error.code) {
      case "USER_ALREADY_EXISTS":
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
        return { field: "email", error: t("errors.emailTaken") };
      case "INVALID_EMAIL":
        return { field: "email", error: t("validation.emailInvalid") };
      case "USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER":
        return { field: "username", error: t("errors.usernameTaken") };
      case "USERNAME_TOO_SHORT":
        return {
          field: "username",
          error: t("errors.usernameTooShort", { min: serverUsernameMinLength }),
        };
      case "USERNAME_IS_TOO_LONG":
      case "USERNAME_IS_INVALID":
        return { field: "username", error: t("errors.usernameInvalid") };
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

  return (
    <>
      <AuthHeading title={t("register.title")} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <AuthField
          id={form.id("name")}
          label={t("fields.name")}
          error={form.errorFor("name")}
        >
          {(control) => (
            <Input
              {...form.field("name")}
              {...control}
              size="lg"
              autoFocus
              autoComplete="name"
            />
          )}
        </AuthField>
        <AuthField
          id={form.id("username")}
          label={t("fields.username")}
          hint={t("fields.usernameHint")}
          error={form.errorFor("username")}
        >
          {(control) => (
            <Input
              {...form.field("username")}
              {...control}
              onChange={(event) =>
                form.setValue("username", normalizeUsername(event.target.value))
              }
              size="lg"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </AuthField>
        <AuthField
          id={form.id("email")}
          label={t("fields.email")}
          error={form.errorFor("email")}
        >
          {(control) => (
            <Input
              {...form.field("email")}
              {...control}
              type="email"
              size="lg"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </AuthField>
        <AuthField
          id={form.id("password")}
          label={t("fields.password")}
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
          {t("register.submit")}
        </Button>
      </form>
      {hasSocialSignIn(providers) ? (
        <>
          <OrDivider label={t("or")} />
          <SocialSignIn
            providers={providers}
            callbackURL={next}
            errorCallbackURL="/register"
            disabled={form.pending}
            onError={form.setFormError}
          />
        </>
      ) : null}
      <AuthPrompt
        prompt={t("register.prompt")}
        action={t("register.login")}
        href="/login"
      />
    </>
  );
}
