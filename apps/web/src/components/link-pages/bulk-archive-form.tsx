"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@shortn/ui";
import { bulkLinkArchiveAction } from "@/server/actions/bulk-link-archive";

export function BulkArchiveForm({
  workspace,
  selectionRef,
  count,
  archived,
}: {
  workspace: string;
  selectionRef: string;
  count: number;
  archived: boolean;
}) {
  const t = useTranslations("bulkArchive"),
    [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState<{
      selected: number;
      updated: number;
    } | null>(null);
  const guard = useRef(false),
    alert = useRef<HTMLParagraphElement>(null),
    back = `/${workspace}/links${archived ? "" : "?archived=1"}`;
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guard.current || !confirmed) return;
    guard.current = true;
    setPending(true);
    setError("");
    try {
      const result = await bulkLinkArchiveAction(
        workspace,
        selectionRef,
        archived,
      );
      if (result.error) setError(result.error);
      else if (result.value) {
        const key = `shortn:bulk-selection:/${workspace}/links/delete`;
        try {
          sessionStorage.setItem(key, "[]");
          window.dispatchEvent(
            new CustomEvent("shortn:bulk-selection", { detail: key }),
          );
        } catch {
          /* The mutation still succeeded. */
        }
        setSuccess(result.value);
      }
    } catch {
      setError("failed");
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  if (success)
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-small">
          {t(archived ? "success" : "unarchiveSuccess", success)}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${workspace}/links${archived ? "?archived=1" : ""}`}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            {t(archived ? "viewArchived" : "back")}
          </Link>
          <Link
            href={back}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t(archived ? "back" : "viewArchived")}
          </Link>
        </div>
      </div>
    );
  const errorKey =
    error === "forbidden" || error === "not_found" || error === "invalid_input"
      ? error
      : "failed";
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-5">
      <p className="text-small text-fg-muted">
        {t(archived ? "effect" : "unarchiveEffect", { count })}
      </p>
      <label className="flex items-start gap-2 text-small">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={pending}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        />
        {t(archived ? "confirm" : "unarchiveConfirm", { count })}
      </label>
      {error ? (
        <p
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="text-small text-danger"
        >
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={pending || !confirmed}
        >
          {t(archived ? "apply" : "unarchive")}
        </Button>
        <Link
          href={back}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
