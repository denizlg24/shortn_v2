"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import {
  AuthHeading,
  AuthPrompt,
  FormAlert,
  strong,
} from "@/components/auth/auth-parts";
import { isEmail } from "@/components/auth/rules";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { rememberVerifyEmail } from "@/components/auth/verify-email-cookie";

export type VerifyState = "sent" | "unverified" | "expired" | "invalid";

const resendCooldownMs = 30_000;

export function VerifyPanel({
  state,
  email,
}: {
  state: VerifyState;
  email: string | null;
}) {
  const t = useTranslations("auth");
  const [sent, setSent] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const form = useAuthForm(
    { email: email ?? "" },
    (values) => {
      const value = values.email.trim();
      return {
        email: !value
          ? t("validation.emailRequired")
          : isEmail(value)
            ? undefined
            : t("validation.emailInvalid"),
      };
    },
    { fallbackError: t("errors.network") },
  );

  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setTimeout(
      () => setCoolingDown(false),
      resendCooldownMs,
    );
    return () => window.clearTimeout(timer);
  }, [coolingDown]);

  const onSubmit = form.submit(async (values) => {
    const address = values.email.trim();
    setSent(false);
    const { error } = await authClient.sendVerificationEmail({
      email: address,
      callbackURL: "/verify",
    });
    if (!error) {
      rememberVerifyEmail(address);
      setSent(true);
      setCoolingDown(true);
      return "done";
    }
    if (error.code === "INVALID_EMAIL")
      return { field: "email", error: t("validation.emailInvalid") };
    if (error.code === "EMAIL_IS_ALREADY_VERIFIED")
      return { formError: t("verify.alreadyVerified") };
    return {
      formError:
        error.status === 429
          ? t("errors.tooManyAttempts")
          : t("errors.generic"),
    };
  });

  const knownAddress = email && (state === "sent" || state === "unverified");
  const title = {
    sent: email ? t("verify.sentTitle") : t("verify.askTitle"),
    unverified: t("verify.unverifiedTitle"),
    expired: t("verify.expiredTitle"),
    invalid: t("verify.invalidTitle"),
  }[state];
  const description = {
    sent: email
      ? t.rich("verify.sentBody", { email, strong })
      : t("verify.askBody"),
    unverified: email
      ? t.rich("verify.unverifiedBody", { email, strong })
      : t("verify.unverifiedAskBody"),
    expired: t("verify.expiredBody"),
    invalid: t("verify.invalidBody"),
  }[state];

  return (
    <>
      <AuthHeading title={title} description={description} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {knownAddress ? (
          state === "sent" ? (
            <p className="text-center text-small text-pretty text-fg-muted">
              {t("verify.spam")}
            </p>
          ) : null
        ) : (
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
                autoFocus
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
              />
            )}
          </AuthField>
        )}
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
        <Button
          type="submit"
          variant={knownAddress && state === "sent" ? "secondary" : "primary"}
          size="lg"
          className="w-full"
          loading={form.pending}
          disabled={coolingDown}
        >
          {knownAddress && state === "sent"
            ? t("verify.resend")
            : t("verify.send")}
        </Button>
        <p
          role="status"
          className="min-h-4 text-center text-meta text-fg-muted empty:min-h-0"
        >
          {sent ? t("verify.sent") : null}
        </p>
      </form>
      <AuthPrompt prompt={null} action={t("verify.back")} href="/login" />
    </>
  );
}
