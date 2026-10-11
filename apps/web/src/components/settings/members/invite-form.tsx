"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { FormActions, FormField, inputClass } from "@/components/page/form";
import { Section } from "@/components/page/page";
import type { SettingsFormState } from "@/server/actions/settings-pages";
import { RoleChoices } from "./role-choices";
import type { AssignableRole } from "./roles";

export function InviteForm({
  roles,
  action,
  cancelHref,
  plansHref,
}: {
  roles: AssignableRole[];
  action: (
    state: SettingsFormState,
    form: FormData,
  ) => Promise<SettingsFormState>;
  cancelHref: string;
  /** Where to upgrade when seats run out; null when only the owner can. */
  plansHref: string | null;
}) {
  const t = useTranslations("settings");
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const id = useId();

  const message = (code: string) => {
    switch (code) {
      case "email_required":
        return t("invite.errors.emailRequired");
      case "invalid_email":
      case "invalid_input":
        return t("invite.errors.emailInvalid");
      case "already_member":
        return t("invite.errors.alreadyMember");
      case "seats_exhausted":
        return t(
          plansHref
            ? "invite.errors.seatsExhausted"
            : "invite.errors.seatsExhaustedAskOwner",
          { seats: Number(state.detail?.seats ?? 1) },
        );
      case "forbidden":
        return t("members.readOnly");
      default:
        return t("common.errors.generic");
    }
  };
  const emailError =
    state.error && state.field === "email" ? message(state.error) : undefined;

  return (
    <form action={formAction} noValidate>
      <Section title={t("invite.who")}>
        <FormField
          id={`${id}-email`}
          label={t("invite.email")}
          hint={t("invite.emailHint")}
          error={emailError}
        >
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("invite.emailPlaceholder")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            aria-invalid={Boolean(emailError)}
            aria-describedby={`${id}-email-${emailError ? "error" : "hint"}`}
            className={inputClass}
          />
        </FormField>
      </Section>
      <Section title={t("invite.role")} description={t("invite.roleHint")}>
        <RoleChoices
          roles={roles}
          value={role}
          onChange={setRole}
          legend={t("invite.role")}
        />
      </Section>
      {state.error && state.field !== "email" ? (
        <p role="alert" className="mt-4 text-small text-danger">
          {message(state.error)}{" "}
          {state.error === "seats_exhausted" && plansHref ? (
            <Link
              href={plansHref}
              className="font-medium text-signal hover:underline"
            >
              {t("common.seePlans")}
            </Link>
          ) : null}
        </p>
      ) : null}
      <FormActions
        submitLabel={t("invite.submit")}
        cancelHref={cancelHref}
        cancelLabel={t("common.cancel")}
        pending={pending}
      />
    </form>
  );
}
