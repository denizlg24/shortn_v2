"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Input } from "@shortn/ui";
import { AtSign, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/auth-field";
import {
  AuthHeading,
  AuthPrompt,
  FormAlert,
  OrDivider,
} from "@/components/auth/auth-parts";
import type { OAuthFailure } from "@/components/auth/oauth-failure";
import { PasswordInput } from "@/components/auth/password-input";
import { SocialSignIn } from "@/components/auth/social-sign-in";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { useOAuthFailureMessage } from "@/components/auth/use-oauth-failure-message";
import { rememberVerifyEmail } from "@/components/auth/verify-email-cookie";

export function LoginForm({ oauthFailure }: { oauthFailure: OAuthFailure }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const oauthMessage = useOAuthFailureMessage(oauthFailure);
  const form = useAuthForm(
    { identifier: "", password: "" },
    (values) => ({
      identifier: values.identifier.trim()
        ? undefined
        : t("validation.identifierRequired"),
      password: values.password ? undefined : t("validation.passwordRequired"),
    }),
    {
      fallbackError: t("errors.network"),
      initialFormError: oauthMessage,
    },
  );
  const usingEmail = form.values.identifier.includes("@");

  const onSubmit = form.submit(async (values) => {
    const identifier = values.identifier.trim();
    const viaEmail = identifier.includes("@");
    const { error } = viaEmail
      ? await authClient.signIn.email({
          email: identifier,
          password: values.password,
          callbackURL: "/",
        })
      : await authClient.signIn.username({
          username: identifier,
          password: values.password,
          callbackURL: "/",
        });
    if (!error) return "navigating";

    switch (error.code) {
      case "EMAIL_NOT_VERIFIED":
        rememberVerifyEmail(viaEmail ? identifier : null);
        router.push("/verify?reason=unverified");
        return "navigating";
      case "INVALID_EMAIL_OR_PASSWORD":
        return {
          field: "password",
          error: t("errors.invalidEmailCredentials"),
        };
      case "INVALID_USERNAME_OR_PASSWORD":
        return {
          field: "password",
          error: t("errors.invalidUsernameCredentials"),
        };
      case "INVALID_EMAIL":
        return { field: "identifier", error: t("validation.emailInvalid") };
      case "USERNAME_TOO_SHORT":
      case "USERNAME_IS_TOO_LONG":
      case "USERNAME_IS_INVALID":
        return { field: "identifier", error: t("errors.useEmailToSignIn") };
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
      <AuthHeading title={t("login.title")} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <AuthField
          id={form.id("identifier")}
          label={t("fields.identifier")}
          error={form.errorFor("identifier")}
        >
          {(control) => (
            <Input
              {...form.field("identifier")}
              {...control}
              size="lg"
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              leading={
                usingEmail ? <Mail aria-hidden /> : <AtSign aria-hidden />
              }
            />
          )}
        </AuthField>
        <AuthField
          id={form.id("password")}
          label={t("fields.password")}
          error={form.errorFor("password")}
          aside={
            <Link
              href="/recover"
              className="text-meta text-fg-muted hover:text-fg hover:underline"
            >
              {t("login.forgot")}
            </Link>
          }
        >
          {(control) => (
            <PasswordInput
              {...form.field("password")}
              {...control}
              size="lg"
              autoComplete="current-password"
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
          {t("login.submit")}
        </Button>
      </form>
      <OrDivider label={t("or")} />
      <SocialSignIn
        errorCallbackURL="/login"
        disabled={form.pending}
        onError={form.setFormError}
      />
      <AuthPrompt
        prompt={t("login.prompt")}
        action={t("login.register")}
        href="/register"
      />
    </>
  );
}
