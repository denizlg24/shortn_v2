"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { buttonVariants } from "@shortn/ui";
import {
  changeImportAction,
  completeImportUploadAction,
} from "@/server/actions/imports";
import {
  importErrorKey,
  importControl,
  importFields,
  type ImportStatus,
} from "@/lib/imports";
import { ImportError } from "./upload";

const active = new Set([
  "inspect_pending",
  "inspecting",
  "validate_pending",
  "validating",
  "commit_pending",
  "committing",
]);
export function ImportJobPanel({
  workspace,
  job,
}: {
  workspace: string;
  job: ImportStatus;
}) {
  const t = useTranslations("imports"),
    format = useFormatter(),
    router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, refresh] = useTransition();
  const locked = useRef(false);
  useEffect(() => {
    if (!active.has(job.state)) return;
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !refreshing &&
        !locked.current
      )
        refresh(() => router.refresh());
    }, 2000);
    return () => clearInterval(timer);
  }, [job.state, refreshing, router]);
  useEffect(() => {
    const delay = Date.parse(job.expiresAt) - Date.now();
    const timer = setTimeout(
      () => router.refresh(),
      Math.max(0, Math.min(delay + 100, 2_147_483_647)),
    );
    return () => clearTimeout(timer);
  }, [job.expiresAt, router]);
  async function mutate(input: unknown, upload = false) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = upload
        ? await completeImportUploadAction(workspace, job.id)
        : await changeImportAction(workspace, job.id, input);
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch {
      setError("failed");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      mapping: Record<string, number> = {};
    for (const field of importFields) {
      const value = data.get(field);
      if (typeof value === "string" && value !== "")
        mapping[field] = Number(value);
    }
    void mutate({ action: "validate", mapping });
  }
  const mapping = job.state === "mapping" || job.state === "ready";
  const terminal = ["completed", "failed", "cancelled"].includes(job.state);
  const creating = job.state === "committing" || job.state === "commit_pending",
    validating = job.state === "validating" || job.state === "validate_pending";
  const count = creating
    ? job.done
    : validating
      ? job.validated
      : job.inspected;
  const total = creating ? job.valid : job.total;
  const mappingContent = (
    <>
      {mapping && job.columns && job.canEdit ? (
        <form onSubmit={validate} className="mb-6 border-b border-line pb-6">
          <fieldset disabled={busy}>
            <legend className="text-body font-semibold">
              {t(job.state === "ready" ? "remap" : "mapping")}
            </legend>
            <p className="mt-2 max-w-prose text-small text-fg-muted">
              {t("mappingHelp")}
            </p>
            <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {importFields.map((field) => (
                <label
                  key={`${job.state}-${field}-${job.mapping?.[field]}`}
                  className="min-w-0 text-small font-medium"
                >
                  {t(`fields.${field}`)}
                  <select
                    name={field}
                    required={field === "url"}
                    defaultValue={job.mapping?.[field] ?? ""}
                    className={`${importControl} mt-2`}
                  >
                    <option value="">
                      {t(field === "url" ? "chooseColumn" : "ignore")}
                    </option>
                    {job.columns!.map((column, index) => (
                      <option key={index} value={index}>
                        {index + 1}. {column.slice(0, 200)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className={`${buttonVariants({ variant: "secondary", size: "md" })} mt-5`}
            >
              {t("validate")}
            </button>
          </fieldset>
        </form>
      ) : null}
      {mapping && job.preview?.length ? (
        <section className="mb-6" aria-labelledby="preview-title">
          <h2 id="preview-title" className="text-body font-semibold">
            {t("preview", { count: job.preview.length, total: job.total })}
          </h2>
          <p className="mt-2 text-small text-fg-muted">{t("previewHelp")}</p>
          <div
            className="mt-4 max-w-full overflow-x-auto rounded-control border border-line"
            tabIndex={0}
            role="region"
            aria-label={t("previewTable")}
          >
            <table className="w-full text-left text-small">
              <thead className="bg-bg-subtle">
                <tr>
                  <th scope="col" className="px-3 py-3">
                    {t("row")}
                  </th>
                  {job.columns?.map((column, index) => (
                    <th key={index} scope="col" className="max-w-64 px-3 py-3">
                      <span className="block w-48 truncate" title={column}>
                        {column}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {job.preview.map((row) => (
                  <tr key={row.row} className="border-t border-line">
                    <th
                      scope="row"
                      className="px-3 py-3 font-normal tabular-nums"
                    >
                      {row.row}
                    </th>
                    {job.columns?.map((_, index) => (
                      <td key={index} className="px-3 py-3">
                        <span
                          className="block w-48 truncate"
                          title={row.cells[index]}
                        >
                          {row.cells[index]}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
  return (
    <div aria-busy={busy}>
      {error ? <ImportError code={error} /> : null}
      <div className="mb-6 border-b border-line pb-5">
        <h2
          className="text-body font-semibold"
          aria-live="polite"
          aria-atomic="true"
        >
          {t(`states.${job.state}`)}
        </h2>
        {active.has(job.state) ? (
          <>
            <p className="mt-2 text-small text-fg-muted">
              {t("progress", {
                done: format.number(count),
                total: format.number(total),
              })}
            </p>
            <progress
              aria-label={t(`states.${job.state}`)}
              {...(total ? { value: Math.min(count, total), max: total } : {})}
              className="mt-3 h-2 w-full max-w-xl accent-signal"
            />
            <p className="mt-2 text-small text-fg-muted">{t("background")}</p>
          </>
        ) : null}
        {terminal ? (
          <p className="mt-2 text-small">
            {t("outcome", {
              done: format.number(job.done),
              total: format.number(job.valid),
            })}
          </p>
        ) : null}
        {job.error ? (
          <p role="alert" className="mt-3 max-w-prose text-small text-fg-muted">
            {t(importErrorKey(job.error))}
          </p>
        ) : null}
      </div>
      {job.state === "ready" ? (
        <section
          className="mb-6 border-b border-line pb-6"
          aria-labelledby="review-title"
        >
          <h2 id="review-title" className="text-body font-semibold">
            {t("review")}
          </h2>
          <p className="mt-2 text-small">
            {t("summary", {
              valid: format.number(job.valid),
              invalid: format.number(job.invalid),
              total: format.number(job.total),
            })}
          </p>
          <p className="mt-2 text-small text-fg-muted">{t("dryRunHelp")}</p>
          {job.quota ? (
            <dl className="mt-4 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {(["used", "reserved", "requested", "available"] as const).map(
                (key) => (
                  <div key={key}>
                    <dt className="text-meta text-fg-muted">
                      {t(`quota.${key}`)}
                    </dt>
                    <dd className="mt-1 text-small tabular-nums">
                      {typeof job.quota![key] === "number"
                        ? format.number(job.quota![key] as number)
                        : job.quota![key] === null
                          ? t("unlimited")
                          : "—"}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          ) : null}
          {job.errorCsvUrl ? (
            <a
              href={job.errorCsvUrl}
              className="mt-4 inline-block text-small text-signal hover:underline"
            >
              {t("downloadErrors")}
            </a>
          ) : null}
          {job.canEdit ? (
            <div className="mt-5">
              <button
                type="button"
                disabled={busy || job.valid === 0}
                onClick={() => void mutate({ action: "commit" })}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                {t(job.kind === "qr" ? "createQr" : "createLinks", {
                  count: job.valid,
                })}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      {job.state === "ready" ? (
        <details className="mb-6 border-b border-line pb-5">
          <summary className="cursor-pointer text-small font-medium text-signal focus-visible:outline-2 focus-visible:outline-signal">
            {t(job.canEdit ? "remap" : "previewSource")}
          </summary>
          <div className="mt-5">{mappingContent}</div>
        </details>
      ) : (
        mappingContent
      )}
      {job.canCancel && !terminal ? (
        <p className="mb-3 text-small text-fg-muted">{t("cancelHelp")}</p>
      ) : null}
      <div className="mb-6 flex flex-wrap gap-3">
        {job.state === "uploading" && job.canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void mutate({}, true)}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t("checkUpload")}
          </button>
        ) : null}
        {job.canCancel && !terminal ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void mutate({ action: "cancel" })}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t("cancel")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
