"use client";

import { useActionState } from "react";
import { buttonVariants } from "@shortn/ui";
import type { SettingsFormState } from "@/server/actions/settings-pages";
import { useBillingError } from "./use-billing-error";

/** Free → paid goes straight to Polar's checkout, which is its own confirmation. */
export function CheckoutButton({
  label,
  action,
}: {
  label: string;
  action: (
    state: SettingsFormState,
    form: FormData,
  ) => Promise<SettingsFormState>;
}) {
  const errorFor = useBillingError();
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={buttonVariants({
          variant: "primary",
          size: "sm",
          className: "w-full",
        })}
      >
        {label}
      </button>
      {state.error ? (
        <p role="alert" className="text-meta text-danger">
          {errorFor(state.error)}
        </p>
      ) : null}
    </form>
  );
}
