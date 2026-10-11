"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/server/actions/link-pages";

/**
 * A form posting to a server action that redirects on success. React resets
 * uncontrolled fields once a form `action` settles, which would wipe what
 * was typed whenever the server answers with a field error; dispatching
 * from onSubmit keeps the fields as typed. `ready` can hold the post back
 * (a check that failed on the client).
 */
export function useFormSubmit(
  action: (state: FormState, form: FormData) => Promise<FormState>,
  ready?: () => boolean,
) {
  const [state, dispatch, pending] = useActionState(action, { error: null });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      pending ||
      event.currentTarget.querySelector('[data-uploading="true"]') ||
      (ready && !ready())
    )
      return;
    const form = new FormData(event.currentTarget);
    startTransition(() => dispatch(form));
  };
  return { state, pending, onSubmit };
}
