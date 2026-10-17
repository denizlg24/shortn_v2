"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@shortn/ui";
import { workspaceExportErrorKey } from "@/lib/workspace-export";

export function WorkspaceExportForm({
  workspace,
  activeId,
}: {
  workspace: string;
  activeId?: string | undefined;
}) {
  const t = useTranslations("workspaceExports"),
    router = useRouter(),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const guard = useRef(false),
    token = useRef<string | null>(null),
    alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guard.current || activeId) return;
    guard.current = true;
    setPending(true);
    setError("");
    token.current ??= crypto.randomUUID();
    try {
      const response = await fetch(
        `/api/workspace-exports/${encodeURIComponent(workspace)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: token.current }),
        },
      );
      const value = await response.json();
      if (!response.ok || !value.job?.id)
        throw new Error(value.error ?? "failed");
      router.push(`/${workspace}/settings/workspace/exports/${value.job.id}`);
    } catch (value) {
      setError(value instanceof Error ? value.message : "failed");
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={pending}>
      {activeId ? (
        <p role="status" className="text-small text-fg-muted">
          {t("activeHelp")}
        </p>
      ) : null}
      {error ? (
        <p
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="text-small text-danger"
        >
          {t(workspaceExportErrorKey(error))}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {activeId ? (
          <Link
            href={`/${workspace}/settings/workspace/exports/${activeId}`}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            {t("continue")}
          </Link>
        ) : (
          <Button type="submit" loading={pending} disabled={pending}>
            {t("prepare")}
          </Button>
        )}
        <Link
          href={`/${workspace}/settings/workspace/exports`}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("history")}
        </Link>
      </div>
    </form>
  );
}
