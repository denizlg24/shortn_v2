"use client";

import { cn } from "@shortn/ui";
import { CircleAlert } from "lucide-react";
import type { ActionResult } from "@/server/actions/result";
import { UpgradeLink } from "../plan-gate";

export type ActionFailure = Extract<ActionResult<null>, { ok: false }>;

export const networkFailure: ActionFailure = { ok: false, error: "network" };

/** A failed action, mapped to the field it belongs to. */
export interface ActionError<Field extends string> {
  field: Field;
  message: string;
  /** The way out is a bigger plan: shows the upgrade link. */
  upgrade?: boolean;
}

/** Calls a server action and turns a thrown request into a failure. */
export async function settle<T>(
  action: Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await action;
  } catch {
    return networkFailure;
  }
}

export function ErrorText({
  error,
  id,
  className,
}: {
  error: { message: string; upgrade?: boolean };
  id?: string;
  className?: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      className={cn("flex gap-2 text-small text-danger", className)}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 text-pretty">
        {error.message}
        {error.upgrade ? (
          <>
            {" "}
            <UpgradeLink />
          </>
        ) : null}
      </span>
    </p>
  );
}
