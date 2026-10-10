"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Input } from "@shortn/ui";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { FormAlert } from "@/components/auth/auth-parts";
import { isEmail } from "@/components/auth/rules";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { Notice, SettingsSection } from "../section";
import { strong } from "@/lib/rich-text";

export function EmailForm({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const t = useTranslations("settings");
  const [requested, setRequested] = useState<string | null>(null);
  // A fresh form after each request, so the cleared field isn't flagged.
  const [round, setRound] = useState(0);

  return (
    <SettingsSection
      title={t("account.email.title")}
      description={t.rich(
        verified ? "account.email.current" : "account.email.currentUnverified",
        { email, strong },
      )}
    >
      <EmailChangeForm
        key={round}
        email={email}
        onRequested={(next) => {
          setRequested(next);
          setRound((value) => value + 1);
        }}
        onEdit={() => setRequested(null)}
      />
      {requested ? (
        <Notice tone="success" live="status">
          {t.rich("account.email.sent", {
            current: email,
            next: requested,
            strong,
          })}
        </Notice>
      ) : null}
    </SettingsSection>
  );
}

function EmailChangeForm({
  email,
  onRequested,
  onEdit,
}: {
  email: string;
  onRequested: (email: string) => void;
  onEdit: () => void;
}) {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const form = useAuthForm(
    { email: "" },
    (values) => {
      const next = values.email.trim().toLowerCase();
      return {
        email: !next
          ? tAuth("validation.emailRequired")
          : !isEmail(next)
            ? tAuth("validation.emailInvalid")
            : next === email.toLowerCase()
              ? t("account.email.errors.same")
              : undefined,
      };
    },
    { fallbackError: t("common.errors.network") },
  );

  const onSubmit = form.submit(async (values) => {
    const newEmail = values.email.trim().toLowerCase();
    const { error } = await authClient.changeEmail({
      newEmail,
      callbackURL: window.location.pathname,
    });
    if (!error) {
      onRequested(newEmail);
      return "done";
    }
    switch (error.code) {
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      case "USER_ALREADY_EXISTS":
        return { field: "email", error: t("account.email.errors.taken") };
      case "EMAIL_IS_THE_SAME":
        return { field: "email", error: t("account.email.errors.same") };
    }
    return {
      formError:
        error.status === 429
          ? tAuth("errors.tooManyAttempts")
          : t("common.errors.generic"),
    };
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <AuthField
        id={form.id("email")}
        label={t("account.email.new")}
        error={form.errorFor("email")}
      >
        {(control) => (
          <Input
            {...form.field("email")}
            {...control}
            onChange={(event) => {
              onEdit();
              form.setValue("email", event.target.value);
            }}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            leading={<Mail aria-hidden />}
          />
        )}
      </AuthField>
      {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
      <div>
        <Button type="submit" variant="primary" loading={form.pending}>
          {t("account.email.submit")}
        </Button>
      </div>
    </form>
  );
}
