import { buttonVariants } from "@shortn/ui";
import type { AdminDenial } from "@shortn/core";
import type { ReactNode } from "react";

/** Renders the action form, or why it can't be used yet. */
export function ActionGate({
  denial,
  next,
  children,
}: {
  denial: AdminDenial | null;
  /** This page's path, to come back to after step-up. */
  next: string;
  children: ReactNode;
}) {
  if (denial === "forbidden")
    return (
      <p className="text-small text-fg-muted">
        This action needs the superadmin role.
      </p>
    );
  if (denial === "step_up_required")
    return (
      <div className="flex max-w-xl flex-col items-start gap-3 border-y border-line py-4">
        <p className="text-small">
          This action needs a fresh authenticator check (within the last 10
          minutes).
        </p>
        <a
          href={`/auth/step-up?next=${encodeURIComponent(next)}`}
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          Confirm with authenticator
        </a>
      </div>
    );
  return children;
}
