"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@shortn/ui";
import type { AnalyticsExportInput, Dimension } from "@shortn/core";
import { linkExportErrorKey } from "@/lib/link-export";

export function AnalyticsExportForm({
  workspace,
  query,
  count,
  back,
  windowEmpty,
}: {
  workspace: string;
  query: AnalyticsExportInput;
  count: number;
  back: string;
  windowEmpty: boolean;
}) {
  const t = useTranslations("analyticsExports"),
    router = useRouter(),
    [mode, setMode] = useState<"aggregate" | "raw">("aggregate"),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false),
    token = useRef<string | null>(null),
    alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    token.current ??= crypto.randomUUID();
    const format = String(new FormData(event.currentTarget).get("format"));
    try {
      const response = await fetch(
        `/api/analytics-exports/${encodeURIComponent(workspace)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: { ...query, mode, format },
            requestId: token.current,
          }),
        },
      );
      const value = await response.json();
      if (!response.ok || !value.job?.id)
        throw new Error(value.error ?? "failed");
      router.push(`/${workspace}/analytics/exports/${value.job.id}`);
    } catch (value) {
      const code = value instanceof Error ? value.message : "failed";
      setError(code);
      if (code === "idempotency_conflict") token.current = null;
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  const changed = () => {
    token.current = null;
    setError("");
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={pending}>
      <label className="flex flex-col gap-2 text-small font-medium">
        {t("mode")}
        <select
          name="mode"
          value={mode}
          disabled={pending}
          onChange={(event) => {
            setMode(event.target.value as "aggregate" | "raw");
            changed();
          }}
          className="h-9 rounded-control border border-line-strong bg-field px-3 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
        >
          <option value="aggregate">{t("modes.aggregate")}</option>
          <option value="raw">{t("modes.raw")}</option>
        </select>
      </label>
      <p className="text-small text-fg-muted">
        {t(mode === "aggregate" ? "aggregateHelp" : "rawHelp")}
      </p>
      {mode === "aggregate" ? (
        <details className="text-small">
          <summary className="cursor-pointer rounded-control text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
            {t("dimensionsSummary", { count: query.dimensions.length })}
            {query.dimensions.length === 1
              ? ` · ${t(`dimensions.${query.dimensions[0] as Dimension}`)}`
              : ""}
          </summary>
          <p className="mt-2 break-words text-fg-muted">
            {query.dimensions
              .map((key) => t(`dimensions.${key as Dimension}`))
              .join(", ")}
          </p>
        </details>
      ) : null}
      <label className="flex flex-col gap-2 text-small font-medium">
        {t("format")}
        <select
          key={mode}
          name="format"
          defaultValue="csv"
          disabled={pending}
          onChange={changed}
          className="h-9 rounded-control border border-line-strong bg-field px-3 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
        >
          <option value="csv">CSV</option>
          {mode === "raw" ? <option value="ndjson">NDJSON</option> : null}
        </select>
      </label>
      <p className="text-small text-fg-muted">{t("deliveryHelp")}</p>
      {count === 0 ? (
        <p role="status" className="text-small text-fg-muted">
          {t("empty")}
        </p>
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
        <Button
          type="submit"
          loading={pending}
          disabled={pending || windowEmpty || (count === 0 && mode === "raw")}
        >
          {t("prepare")}
        </Button>
        <Link
          href={back}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("back")}
        </Link>
      </div>
    </form>
  );
}
