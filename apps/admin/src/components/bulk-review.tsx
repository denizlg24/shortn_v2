"use client";
import { useActionState } from "react";
import { Button } from "@shortn/ui";
import { useSelection } from "@/lib/selection";
export function BulkReview({
  action,
  max,
}: {
  action: (
    state: { error: string } | null,
    form: FormData,
  ) => Promise<{ error: string } | null>;
  max: number;
}) {
  const ids = useSelection("links");
  const [state, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="flex max-w-xl flex-col items-start gap-3">
      <p className="text-small">
        {ids.length} selected across pages and filters. Limit: {max} links per
        operation.
      </p>
      <input name="ids" type="hidden" value={JSON.stringify(ids)} />
      {state?.error ? (
        <p role="alert" className="text-small text-danger">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        loading={pending}
        disabled={!ids.length || ids.length > max}
      >
        Freeze selection for review
      </Button>
    </form>
  );
}
