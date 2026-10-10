"use client";

import { authClient } from "@shortn/auth/client";
import { Button, Checkbox, Label } from "@shortn/ui";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AuthField } from "@/components/auth/auth-field";
import { FormAlert } from "@/components/auth/auth-parts";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { PasswordInput } from "@/components/auth/password-input";
import {
  meetsPasswordPolicy,
  passwordMaxLength,
  serverPasswordMinLength,
} from "@/components/auth/rules";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { Notice, SettingsSection } from "../section";
import { providerName } from "./providers";
import { strong } from "@/lib/rich-text";

export function PasswordSection({
  hasPassword,
  email,
  providers,
}: {
  hasPassword: boolean;
  email: string;
  providers: string[];
}) {
  const t = useTranslations("settings.account.password");
  const format = useFormatter();
  const [updated, setUpdated] = useState<"kept" | "revoked" | null>(null);
  const [round, setRound] = useState(0);

  if (!hasPassword)
    return (
      <SettingsSection
        title={t("title")}
        description={t.rich("none", {
          providers: format.list(providers.map(providerName), {
            type: "disjunction",
          }),
          email,
          strong,
        })}
      />
    );

  return (
    <SettingsSection title={t("title")}>
      <PasswordForm
        key={round}
        onUpdated={(revoked) => {
          setUpdated(revoked ? "revoked" : "kept");
          setRound((value) => value + 1);
        }}
        onEdit={() => setUpdated(null)}
      />
      {updated ? (
        <Notice tone="success" live="status">
          {updated === "revoked" ? t("updatedRevoked") : t("updated")}
        </Notice>
      ) : null}
    </SettingsSection>
  );
}

function PasswordForm({
  onUpdated,
  onEdit,
}: {
  onUpdated: (revokedOthers: boolean) => void;
  onEdit: () => void;
}) {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const checklistId = useId();
  const revokeId = useId();
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const form = useAuthForm(
    { current: "", next: "" },
    (values) => ({
      current: values.current
        ? undefined
        : t("account.password.errors.currentRequired"),
      next: !values.next
        ? tAuth("validation.passwordRequired")
        : values.next.length > passwordMaxLength
          ? tAuth("errors.passwordTooLong", { max: passwordMaxLength })
          : meetsPasswordPolicy(values.next)
            ? undefined
            : tAuth("validation.passwordPolicy"),
    }),
    { fallbackError: t("common.errors.network") },
  );

  const onSubmit = form.submit(async (values) => {
    const { error } = await authClient.changePassword({
      currentPassword: values.current,
      newPassword: values.next,
      revokeOtherSessions: revokeOthers,
    });
    if (!error) {
      onUpdated(revokeOthers);
      router.refresh();
      return "done";
    }
    switch (error.code) {
      case "INVALID_PASSWORD":
        return {
          field: "current",
          error: t("account.password.errors.currentWrong"),
        };
      case "PASSWORD_TOO_SHORT":
        return {
          field: "next",
          error: tAuth("errors.passwordTooShort", {
            min: serverPasswordMinLength,
          }),
        };
      case "PASSWORD_TOO_LONG":
        return {
          field: "next",
          error: tAuth("errors.passwordTooLong", { max: passwordMaxLength }),
        };
    }
    return {
      formError:
        error.status === 429
          ? tAuth("errors.tooManyAttempts")
          : t("common.errors.generic"),
    };
  });

  const edit = (field: "current" | "next", value: string) => {
    onEdit();
    form.setValue(field, value);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        setAttempted(true);
        void onSubmit(event);
      }}
      className="flex flex-col gap-4"
    >
      <AuthField
        id={form.id("current")}
        label={t("account.password.current")}
        error={form.errorFor("current")}
      >
        {(control) => (
          <PasswordInput
            {...form.field("current")}
            {...control}
            onChange={(event) => edit("current", event.target.value)}
            autoComplete="current-password"
          />
        )}
      </AuthField>
      <AuthField
        id={form.id("next")}
        label={tAuth("fields.newPassword")}
        error={form.errorFor("next")}
        describedBy={checklistId}
        after={
          <PasswordChecklist
            id={checklistId}
            password={form.values.next}
            flagUnmet={attempted}
          />
        }
      >
        {(control) => (
          <PasswordInput
            {...form.field("next")}
            {...control}
            onChange={(event) => edit("next", event.target.value)}
            autoComplete="new-password"
            maxLength={passwordMaxLength}
          />
        )}
      </AuthField>
      <div className="flex items-center gap-2.5">
        <Checkbox
          id={revokeId}
          checked={revokeOthers}
          onCheckedChange={(checked) => setRevokeOthers(checked === true)}
        />
        <Label htmlFor={revokeId} className="font-normal">
          {t("account.password.revokeOthers")}
        </Label>
      </div>
      {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}
      <div>
        <Button type="submit" variant="primary" loading={form.pending}>
          {t("account.password.submit")}
        </Button>
      </div>
    </form>
  );
}
