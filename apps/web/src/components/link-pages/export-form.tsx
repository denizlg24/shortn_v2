"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@shortn/ui";
import { linkExportErrorKey, type LinkExportPrepared } from "@/lib/link-export";
import type { LinkExportFilter } from "@shortn/core";

export function LinkExportForm({
  workspace,
  filter,
  count,
  back,
}: {
  workspace: string;
  filter: LinkExportFilter;
  count: number;
  back: string;
}) {
  const t = useTranslations("linkExports"),
    formatter = useFormatter(),
    router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [prepared, setPrepared] = useState<LinkExportPrepared | null>(null);
  const locked = useRef(false),
    token = useRef<string | null>(null),
    alert = useRef<HTMLParagraphElement>(null),
    download = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  useEffect(() => {
    if (!prepared) return;
    download.current?.focus();
    const timer = setTimeout(
      () => {
        setPrepared(null);
        setError("expired");
        token.current = null;
      },
      Math.max(0, Date.parse(prepared.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [prepared]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    const format = String(new FormData(event.currentTarget).get("format"));
    token.current ??= crypto.randomUUID();
    try {
      const response = await fetch(
        `/api/link-exports/${encodeURIComponent(workspace)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter, format, requestId: token.current }),
        },
      );
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "failed");
      if (value.mode === "job" && value.job?.id)
        router.push(`/${workspace}/links/exports/${value.job.id}`);
      else if (value.mode === "download") setPrepared(value);
      else throw new Error("failed");
    } catch (value) {
      const code = value instanceof Error ? value.message : "failed";
      setError(code);
      if (code === "idempotency_conflict") token.current = null;
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="flex max-w-[560px] flex-col gap-4"
      aria-busy={pending}
    >
      <p className="text-small font-medium">{t("scope", { count })}</p>
      <p className="text-small text-fg-muted">{t("scopeHelp")}</p>
      <label className="flex flex-col gap-2 text-small font-medium">
        {t("format")}
        <select
          name="format"
          defaultValue="csv"
          disabled={pending}
          onChange={() => {
            setPrepared(null);
            setError("");
            token.current = null;
          }}
          className="h-9 rounded-control border border-line-strong bg-field px-3 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </label>
      <p className="text-small text-fg-muted">{t("deliveryHelp")}</p>
      <p className="text-small text-fg-muted">{t("csvHelp")}</p>
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
      {prepared ? (
        <div className="border-y border-line py-4">
          <p role="status" className="text-small font-medium">
            {t("ready", { count: prepared.total })}
          </p>
          <p className="mt-2 text-small text-fg-muted">
            {t("expiresAt", {
              date: formatter.dateTime(new Date(prepared.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
          <a
            ref={download}
            href={prepared.downloadUrl}
            className={`${buttonVariants({ variant: "primary", size: "md" })} mt-4`}
          >
            {t("download", { format: prepared.format.toUpperCase() })}
          </a>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          loading={pending}
          disabled={pending || count === 0}
        >
          {t(prepared ? "prepareAgain" : "prepare")}
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
