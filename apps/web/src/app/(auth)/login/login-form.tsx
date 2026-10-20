"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Input } from "@shortn/ui";
import { useRef, useState } from "react";
import { AtSign, Mail, KeyRound, Building2 } from "lucide-react";
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
import {
  hasSocialSignIn,
  SocialSignIn,
  type EnabledProviders,
} from "@/components/auth/social-sign-in";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { useOAuthFailureMessage } from "@/components/auth/use-oauth-failure-message";
import { rememberVerifyEmail } from "@/components/auth/verify-email-cookie";

export function LoginForm({
  oauthFailure,
  providers,
  next,
  ssoHref,
}: {
  oauthFailure: OAuthFailure;
  providers: EnabledProviders;
  /** Same-app path to land on after signing in (already sanitized). */
  next: string;
  ssoHref: string;
}) {
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
  const [passkeyPending, setPasskeyPending] = useState(false);
  const passkeyBusy = useRef(false);
  const usingEmail = form.values.identifier.includes("@");
  const suspendedMessage = (error: object) => {
    const reason =
      "reason" in error && typeof error.reason === "string"
        ? error.reason.trim()
        : "";
    return reason
      ? t("errors.accountSuspendedReason", { reason })
      : t("errors.accountSuspended");
  };

  const onSubmit = form.submit(async (values) => {
    const identifier = values.identifier.trim();
    const viaEmail = identifier.includes("@");
    const { error } = viaEmail
      ? await authClient.signIn.email({
          email: identifier,
          password: values.password,
          callbackURL: next,
        })
      : await authClient.signIn.username({
          username: identifier,
          password: values.password,
          callbackURL: next,
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
      case "ACCOUNT_SUSPENDED":
        return { formError: suspendedMessage(error) };
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
      <form
        noValidate
        onSubmit={(event) => {
          if (passkeyBusy.current) event.preventDefault();
          else void onSubmit(event);
        }}
        className="flex flex-col gap-4"
      >
        <AuthField
          id={form.id("identifier")}
          label={t("fields.identifier")}
          error={form.errorFor("identifier")}
        >
          {(control) => (
            <Input
              {...form.field("identifier")}
              onBlur={(event) => {
                if (
                  event.relatedTarget instanceof HTMLElement &&
                  event.relatedTarget.closest("form") ===
                    event.currentTarget.form
                )
                  form.field("identifier").onBlur();
              }}
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
              onBlur={(event) => {
                if (
                  event.relatedTarget instanceof HTMLElement &&
                  event.relatedTarget.closest("form") ===
                    event.currentTarget.form
                )
                  form.field("password").onBlur();
              }}
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
          disabled={passkeyPending}
        >
          {t("login.submit")}
        </Button>
      </form>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="mt-3 w-full"
        loading={passkeyPending}
        disabled={form.pending}
        onClick={async () => {
          if (passkeyBusy.current || form.pending) return;
          if (!window.isSecureContext || !window.PublicKeyCredential) {
            form.setFormError(t("passkey.unsupported"));
            return;
          }
          passkeyBusy.current = true;
          setPasskeyPending(true);
          form.setFormError("");
          try {
            const result = await authClient.signIn.passkey();
            if (
              result.error &&
              "code" in result.error &&
              result.error.code === "ACCOUNT_SUSPENDED"
            )
              form.setFormError(suspendedMessage(result.error));
            else if (result.error)
              form.setFormError(
                t(
                  result.error.status === 429
                    ? "errors.tooManyAttempts"
                    : [
                          "AUTH_CANCELLED",
                          "ERROR_CEREMONY_ABORTED",
                          "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
                        ].includes(
                          "code" in result.error ? result.error.code : "",
                        )
                      ? "passkey.cancelled"
                      : "passkey.failed",
                ),
              );
            else {
              const data = result.data as {
                redirect?: boolean;
                url?: string;
              } | null;
              if (data?.redirect && data.url) window.location.assign(data.url);
              else window.location.assign(next);
              return;
            }
          } catch {
            form.setFormError(t("errors.network"));
          }
          passkeyBusy.current = false;
          setPasskeyPending(false);
        }}
      >
        <KeyRound aria-hidden className="size-4" />
        {t("passkey.signIn")}
      </Button>
      <Button asChild variant="secondary" size="lg" className="mt-3 w-full">
        <Link
          href={ssoHref}
          aria-disabled={form.pending || passkeyPending || undefined}
          onClick={(event) => {
            if (form.pending || passkeyPending) event.preventDefault();
          }}
        >
          <Building2 aria-hidden className="size-4" />
          {t("sso.entry")}
        </Link>
      </Button>
      {hasSocialSignIn(providers) ? (
        <>
          <OrDivider label={t("or")} />
          <SocialSignIn
            providers={providers}
            callbackURL={next}
            errorCallbackURL={
              next === "/"
                ? "/login"
                : `/login?next=${encodeURIComponent(next)}`
            }
            disabled={form.pending || passkeyPending}
            onError={form.setFormError}
          />
        </>
      ) : null}
      <AuthPrompt
        prompt={t("login.prompt")}
        action={t("login.register")}
        href={
          next === "/"
            ? "/register"
            : `/register?next=${encodeURIComponent(next)}`
        }
      />
    </>
  );
}
