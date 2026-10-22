"use client";

import { Button, cn } from "@shortn/ui";
import Link from "next/link";
import { useActionState, useId, type ReactNode } from "react";

type State = { error: string } | null;

const control =
  "w-full rounded-control border border-line-strong bg-field px-2.5 py-1.5 text-small text-fg focus-visible:outline-2 focus-visible:outline-signal";

/**
 * A write-action page's form (23 §2.0): fields, a required reason, typed
 * confirmation for destructive actions, and a cancel link back to the
 * detail view. The server action redirects on success.
 */
export function ActionForm({
  action,
  submitLabel,
  cancelHref,
  children,
  reason = "required",
  reasonLabel = "Reason (internal, audited)",
  confirm,
  danger = false,
}: {
  action: (state: State, form: FormData) => Promise<State>;
  submitLabel: string;
  cancelHref: string;
  children?: ReactNode;
  reason?: "required" | "optional" | "none";
  reasonLabel?: string;
  /** The exact text the operator must type, e.g. a slug or email. */
  confirm?: string;
  danger?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, null);
  const reasonId = useId();
  const confirmId = useId();
  return (
    <form action={submit} className="flex max-w-xl flex-col gap-4">
      {children}
      {reason === "none" ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor={reasonId} className="text-small font-medium">
            {reasonLabel}
            {reason === "optional" ? (
              <span className="font-normal text-fg-muted"> · optional</span>
            ) : null}
          </label>
          <textarea
            id={reasonId}
            name="reason"
            rows={3}
            maxLength={1000}
            required={reason === "required"}
            className={control}
          />
        </div>
      )}
      {confirm ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={confirmId} className="text-small font-medium">
            Type <span className="font-mono">{confirm}</span> to confirm
          </label>
          <input
            id={confirmId}
            name="confirm"
            autoComplete="off"
            spellCheck={false}
            required
            className={cn(control, "font-mono")}
          />
        </div>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-small text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant={danger ? "danger" : "primary"}
          loading={pending}
        >
          {submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className="text-small text-fg-muted hover:text-fg"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

/** A labelled native field for action forms. */
export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-meta text-fg-muted">{hint}</p> : null}
    </div>
  );
}

export const fieldClass = control;
