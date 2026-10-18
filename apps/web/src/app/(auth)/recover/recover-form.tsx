"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { AuthField } from "@/components/auth/auth-field";
import {
  AuthHeading,
  AuthPrompt,
  FormAlert,
  strong,
} from "@/components/auth/auth-parts";
import { isEmail } from "@/components/auth/rules";
import { useAuthForm } from "@/components/auth/use-auth-form";

export function RecoverForm() {
  const t = useTranslations("auth");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const sentHeadingId = useId();
  const form = useAuthForm(
    { email: "" },
    (values) => {
      const email = values.email.trim();
      return {
        email: !email
          ? t("validation.emailRequired")
          : isEmail(email)
            ? undefined
            : t("validation.emailInvalid"),
      };
    },
    { fallbackError: t("errors.network") },
  );

  const onSubmit = form.submit(async (values) => {
    const email = values.email.trim();
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset",
    });
    if (!error) {
      flushSync(() => setSentTo(email));
      document.getElementById(sentHeadingId)?.focus();
      return "done";
    }
    if (error.code === "INVALID_EMAIL")
      return { field: "email", error: t("validation.emailInvalid") };
    return {
      formError:
        error.status === 429
          ? t("errors.tooManyAttempts")
          : t("errors.generic"),
    };
  });

  if (sentTo)
    return (
      <>
        <AuthHeading
          id={sentHeadingId}
          title={t("recover.sentTitle")}
          description={t.rich("recover.sentBody", { email: sentTo, strong })}
        />
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href="/login">{t("recover.login")}</Link>
        </Button>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-4 cursor-pointer self-center text-small text-fg-muted hover:text-fg hover:underline"
        >
          {t("recover.retry")}
        </button>
      </>
    );

  return (
    <>
      <AuthHeading
        title={t("recover.title")}
        description={t("recover.description")}
      />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
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
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-1 w-full"
          loading={form.pending}
        >
          {t("recover.submit")}
        </Button>
      </form>
      <AuthPrompt
        prompt={t("recover.prompt")}
        action={t("recover.login")}
        href="/login"
      />
    </>
  );
}
