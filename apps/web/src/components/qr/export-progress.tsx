"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@shortn/ui";
import { Download } from "lucide-react";
import { readQrExportAction } from "@/server/actions/qr-exports";
import { exportErrorKey, type ExportRead } from "@/lib/qr-export";

export function QrExportProgress({
  workspace,
  id,
  kind,
  initial,
}: {
  workspace: string;
  id: string;
  kind: "single" | "zip";
  initial: ExportRead;
}) {
  const t = useTranslations("qrExports"),
    formatter = useFormatter();
  const [result, setResult] = useState(initial),
    [refreshing, refresh] = useTransition();
  const job = result.job,
    active = job?.state === "pending" || job?.state === "running";
  useEffect(() => {
    if (!active) return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const next = await readQrExportAction(workspace, id, kind);
          if (!cancelled) setResult(next);
        } catch {
          if (!cancelled) setResult({ job: null, error: "failed" });
        }
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 2000);
    };
    timer = setTimeout(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workspace, id, kind, active]);
  useEffect(() => {
    if (!job) return;
    const delay = Math.max(0, new Date(job.expiresAt).getTime() - Date.now());
    const timer = setTimeout(
      () => setResult({ job: null, error: "expired" }),
      delay,
    );
    return () => clearTimeout(timer);
  }, [job]);
  const retry = () =>
    refresh(async () => {
      try {
        setResult(await readQrExportAction(workspace, id, kind));
      } catch {
        setResult({ job: null, error: "failed" });
      }
    });
  const failure = job?.error ?? result.error;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {job ? (
        <>
          <div className="flex flex-col gap-2" aria-live="polite">
            <h2 className="text-body font-semibold">
              {t(
                `states.${job.state === "running" && job.phase === "assembling" ? "assembling" : job.state}`,
              )}
            </h2>
            <p role="status" className="text-small text-fg-muted">
              {t("progress", { done: job.done, total: job.total })}
            </p>
          </div>
          {active ? (
            <progress
              aria-label={t("progress", { done: job.done, total: job.total })}
              value={job.done}
              max={job.total}
              className="h-2 w-full accent-[var(--primary)]"
            />
          ) : null}
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 border-y border-line py-4 text-small">
            <dt className="text-fg-muted">{t("format")}</dt>
            <dd>
              {kind === "zip"
                ? t("zipFormat", { format: job.format.toUpperCase() })
                : job.format.toUpperCase()}
            </dd>
            <dt className="text-fg-muted">{t("size")}</dt>
            <dd>{t("pixels", { size: job.size })}</dd>
            <dt className="text-fg-muted">{t("expires")}</dt>
            <dd>
              {formatter.dateTime(new Date(job.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </dl>
          {active ? (
            <p className="text-small text-fg-muted">{t("leaveHint")}</p>
          ) : null}
          {job.print ? (
            <p className="text-small text-fg-muted">
              {t("minimum", {
                size: formatter.number(job.print.minimumMm, {
                  maximumFractionDigits: 1,
                }),
              })}
            </p>
          ) : null}
        </>
      ) : null}
      {failure ? (
        <p role="alert" className="text-small text-danger">
          {t(`errors.${exportErrorKey(failure)}`)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {job?.state === "completed" && job.downloadUrl ? (
          <a
            href={job.downloadUrl}
            referrerPolicy="no-referrer"
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            <Download aria-hidden className="size-4" />
            {t(kind === "zip" ? "downloadZip" : "download")}
          </a>
        ) : null}
        {job?.failedQrId ? (
          <Link
            href={`/${workspace}/qr/${job.failedQrId}${job.canEdit ? "/design" : ""}`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t(job.canEdit ? "reviewDesign" : "reviewCode")}
          </Link>
        ) : null}
        {!job && failure !== "expired" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={retry}
            loading={refreshing}
          >
            {t("refresh")}
          </Button>
        ) : null}
        <Link
          href={`/${workspace}/qr`}
          className={buttonVariants({ variant: "ghost", size: "md" })}
        >
          {t("back")}
        </Link>
      </div>
    </div>
  );
}
