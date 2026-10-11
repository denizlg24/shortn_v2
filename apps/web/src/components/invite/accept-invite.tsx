"use client";

import { Button } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormAlert } from "@/components/auth/auth-parts";
import { acceptInviteAction } from "@/server/actions/invite";

export function AcceptInvite({ token }: { token: string }) {
  const t = useTranslations("invite");
  // On success the action redirects into the workspace.
  const [state, accept, pending] = useActionState(
    () => acceptInviteAction(token),
    null,
  );
  const error =
    state && !state.ok
      ? state.error === "invite_invalid" || state.error === "invalid_input"
        ? t("errors.invalid")
        : state.error === "invite_email_mismatch"
          ? t("errors.mismatch")
          : t("errors.generic")
      : null;

  return (
    <form action={accept} className="flex flex-col gap-4">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        loading={pending}
      >
        {t("accept")}
      </Button>
    </form>
  );
}
