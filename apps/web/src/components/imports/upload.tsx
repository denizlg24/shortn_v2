"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@shortn/ui";
import { pastedImportCsv } from "@shortn/core/import-input";
import {
  prepareImportUploadAction,
  completeImportUploadAction,
  changeImportAction,
} from "@/server/actions/imports";
import { importErrorKey, importControl } from "@/lib/imports";

export function ImportError({ code }: { code: string }) {
  const t = useTranslations("imports"),
    ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [code]);
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="mb-5 rounded-control border border-warning/40 bg-warning/5 px-3 py-2 text-small"
    >
      {t(importErrorKey(code))}
    </p>
  );
}

export function ImportUpload({
  workspace,
  kind,
}: {
  workspace: string;
  kind: "links" | "qr";
}) {
  const t = useTranslations("imports"),
    router = useRouter();
  const [mode, setMode] = useState<"file" | "paste">("file"),
    [phase, setPhase] = useState<"" | "preparing" | "uploading" | "finishing">(
      "",
    ),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  const busy = useRef(false),
    cancelled = useRef(false),
    xhr = useRef<XMLHttpRequest | null>(null);
  useEffect(
    () => () => {
      xhr.current?.abort();
    },
    [],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    busy.current = true;
    cancelled.current = false;
    setError("");
    setProgress(0);
    setPhase("preparing");
    let id: string | undefined;
    try {
      const file = form.get("file"),
        selectedKind = form.get("kind") === "qr" ? "qr" : "links";
      const body =
        mode === "paste"
          ? new Blob(
              [new Uint8Array(pastedImportCsv(String(form.get("urls") ?? "")))],
              { type: "text/csv; charset=utf-8" },
            )
          : file;
      if (
        !(body instanceof Blob) ||
        body.size === 0 ||
        (mode === "paste" && !String(form.get("urls") ?? "").trim())
      )
        throw new Error("empty_file");
      if (body.size > 10 * 1024 * 1024) throw new Error("file_too_large");
      const prepared = await prepareImportUploadAction(workspace, {
        bytes: body.size,
        kind: selectedKind,
      });
      if (!prepared.ok) throw new Error(prepared.error);
      id = prepared.value.id;
      if (cancelled.current) throw new Error("upload_cancelled");
      setPhase("uploading");
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        xhr.current = request;
        request.open("PUT", prepared.value.uploadUrl);
        for (const [name, value] of Object.entries(prepared.value.headers))
          request.setRequestHeader(name, value);
        request.upload.onprogress = (event) => {
          if (event.lengthComputable)
            setProgress(Math.round((event.loaded / event.total) * 100));
        };
        request.onload = () =>
          request.status >= 200 && request.status < 300
            ? resolve()
            : reject(new Error("upload_failed"));
        request.onerror = () => reject(new Error("upload_failed"));
        request.onabort = () => reject(new Error("upload_cancelled"));
        request.timeout = 120_000;
        request.ontimeout = () => reject(new Error("upload_failed"));
        request.send(body);
      });
      if (cancelled.current) throw new Error("upload_cancelled");
      setPhase("finishing");
      const result = await completeImportUploadAction(workspace, id);
      if (!result.ok) throw new Error(result.error);
      router.push(`/${workspace}/imports/${id}`);
    } catch (value) {
      if (id && cancelled.current)
        await changeImportAction(workspace, id, { action: "cancel" }).catch(
          () => undefined,
        );
      setError(
        cancelled.current
          ? "upload_cancelled"
          : value instanceof Error
            ? value.message
            : "failed",
      );
    } finally {
      xhr.current = null;
      busy.current = false;
      setPhase("");
    }
  }
  return (
    <form onSubmit={submit} aria-busy={Boolean(phase)}>
      {error ? <ImportError code={error} /> : null}
      <fieldset disabled={Boolean(phase)} className="space-y-5">
        <label className="block text-small font-medium">
          {t("kind")}
          <select
            name="kind"
            defaultValue={kind}
            className={`${importControl} mt-2`}
          >
            <option value="links">{t("links")}</option>
            <option value="qr">{t("qr")}</option>
          </select>
        </label>
        <fieldset>
          <legend className="mb-2 text-small font-medium">{t("source")}</legend>
          <div className="flex flex-wrap gap-5">
            {(["file", "paste"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-small">
                <input
                  type="radio"
                  name="source"
                  value={value}
                  checked={mode === value}
                  onChange={() => {
                    setMode(value);
                    setError("");
                  }}
                  className="accent-signal"
                />
                {t(value)}
              </label>
            ))}
          </div>
        </fieldset>
        {mode === "file" ? (
          <label className="block text-small font-medium">
            {t("fileLabel")}
            <input
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="mt-2 block w-full min-w-0 rounded-control border border-line-strong p-2 text-small file:mr-3 file:rounded-control file:border-0 file:bg-bg-muted file:px-3 file:py-1 file:text-fg focus-visible:outline-2 focus-visible:outline-signal"
            />
          </label>
        ) : (
          <label className="block text-small font-medium">
            {t("pasteLabel")}
            <textarea
              name="urls"
              required
              rows={8}
              maxLength={10 * 1024 * 1024}
              spellCheck={false}
              className={`${importControl} mt-2 h-auto py-2 font-mono`}
              placeholder="https://example.com/article"
            />
          </label>
        )}
        <p className="text-small text-fg-muted">{t("limits")}</p>
        <p className="text-small text-fg-muted">{t("uploadHelp")}</p>
        <button
          type="submit"
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          {t("continue")}
        </button>
      </fieldset>
      {phase ? (
        <div className="mt-5 space-y-2" role="status">
          <p className="text-small">{t(`phases.${phase}`, { progress })}</p>
          {phase === "uploading" ? (
            <progress
              value={progress}
              max={100}
              aria-label={t("phases.uploading", { progress })}
              className="h-2 w-full accent-signal"
            />
          ) : null}
          <button
            type="button"
            disabled={phase === "finishing"}
            onClick={() => {
              cancelled.current = true;
              xhr.current?.abort();
            }}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t("cancelUpload")}
          </button>
        </div>
      ) : null}
      <Link
        href={`/${workspace}/imports`}
        className="mt-5 inline-block text-small text-signal hover:underline"
      >
        {t("history")}
      </Link>
    </form>
  );
}
