"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@shortn/ui";
import { linkExportErrorKey, type LinkExportRead } from "@/lib/link-export";

export function LinkExportProgress({
  workspace,
  id,
  initial,
}: {
  workspace: string;
  id: string;
  initial: LinkExportRead;
}) {
  const t = useTranslations("linkExports"),
    formatter = useFormatter(),
    [result, setResult] = useState(initial),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  const guard = useRef(false),
    mounted = useRef(true),
    alert = useRef<HTMLParagraphElement>(null);
  const job = result.job,
    active = job?.state === "pending" || job?.state === "running",
    endpoint = `/api/link-exports/${encodeURIComponent(workspace)}/jobs/${id}`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (failure) alert.current?.focus();
  }, [failure]);
  async function read() {
    const response = await fetch(endpoint, { cache: "no-store" }),
      value = await response.json();
    if (!response.ok) {
      if ([401, 403, 404].includes(response.status)) {
        if (mounted.current)
          setResult({ job: null, error: value.error ?? "failed" });
      } else throw new Error(value.error ?? "failed");
    } else if (mounted.current) {
      setResult({ job: value });
      setFailure("");
    }
  }
  useEffect(() => {
    if (!active) return;
    let cancelled = false,
      controller: AbortController | undefined,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === "visible" && !guard.current) {
        controller = new AbortController();
        try {
          const response = await fetch(endpoint, {
              cache: "no-store",
              signal: controller.signal,
            }),
            value = await response.json();
          if (!cancelled) {
            if (response.ok) {
              setResult({ job: value });
              setFailure("");
            } else if ([401, 403, 404].includes(response.status))
              setResult({ job: null, error: value.error ?? "failed" });
            else setFailure(value.error ?? "failed");
          }
        } catch {
          if (!cancelled) setFailure("failed");
        }
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 2000);
    };
    timer = setTimeout(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [active, endpoint]);
  const expiresAt = job?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(
      () => setResult({ job: null, error: "expired" }),
      Math.max(0, Date.parse(expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);
  async function act(cancel = false) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setFailure("");
    try {
      if (cancel) {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "cancel" }),
          }),
          value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "failed");
      }
      await read();
    } catch (error) {
      if (mounted.current)
        setFailure(error instanceof Error ? error.message : "failed");
    } finally {
      guard.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const error = failure || result.error || job?.error;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {job ? (
        <>
          <h2 className="text-body font-semibold" aria-live="polite">
            {t(`states.${job.state}`)}
          </h2>
          <p role="status" className="text-small tabular-nums text-fg-muted">
            {t("progress", {
              done: formatter.number(job.done),
              total: formatter.number(job.total),
            })}
          </p>
          {active ? (
            <progress
              value={job.done}
              max={Math.max(job.total, 1)}
              aria-label={t(`states.${job.state}`)}
              className="h-2 w-full accent-signal"
            />
          ) : null}
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 border-y border-line py-4 text-small">
            <dt className="text-fg-muted">{t("format")}</dt>
            <dd>{job.format.toUpperCase()}</dd>
            <dt className="text-fg-muted">{t("expires")}</dt>
            <dd>
              {formatter.dateTime(new Date(job.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </dl>
          {active ? (
            <p className="text-small text-fg-muted">{t("background")}</p>
          ) : null}
        </>
      ) : null}
      {error ? (
        <p
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="text-small text-danger"
        >
          {t(linkExportErrorKey(error))}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {job?.state === "completed" && job.downloadUrl ? (
          <a
            href={job.downloadUrl}
            referrerPolicy="no-referrer"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            {t("download", { format: job.format.toUpperCase() })}
          </a>
        ) : null}
        {active ? (
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            disabled={busy}
            onClick={() => void act(true)}
          >
            {t("cancel")}
          </Button>
        ) : null}
        {!job || failure ? (
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            disabled={busy}
            onClick={() => void act()}
          >
            {t("refresh")}
          </Button>
        ) : null}
        <Link
          href={`/${workspace}/links/exports`}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("history")}
        </Link>
        <Link
          href={`/${workspace}/links/export`}
          className={buttonVariants({ variant: "ghost", size: "md" })}
        >
          {t("new")}
        </Link>
      </div>
    </div>
  );
}
