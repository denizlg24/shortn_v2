"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@shortn/ui";
import { prepareQrExportAction } from "@/server/actions/qr-exports";
import { exportErrorKey } from "@/lib/qr-export";

export function QrExportForm({
  workspace,
  selection,
  count,
  bundle,
  cancelHref,
  error,
  minimumMm,
  initialFormat = "svg",
}: {
  workspace: string;
  selection: string;
  count: number;
  bundle: boolean;
  cancelHref: string;
  error?: string;
  minimumMm?: number;
  initialFormat?: "svg" | "png" | "pdf";
}) {
  const t = useTranslations("qrExports"),
    formatter = useFormatter();
  const [state, action, pending] = useActionState(
    prepareQrExportAction.bind(null, workspace, bundle),
    {},
  );
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) alert.current?.focus();
  }, [state]);
  const failure = state.error ?? error;
  const field =
    "h-9 min-w-0 rounded-control border border-line-strong bg-field px-3 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
  return (
    <form
      action={action}
      aria-busy={pending}
      className="flex min-w-0 flex-col gap-4"
    >
      <input type="hidden" name="selection" value={selection} />
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <label className="flex min-w-0 flex-col gap-1.5 text-small font-medium">
          {t("format")}
          <select
            name="format"
            defaultValue={initialFormat}
            disabled={pending}
            className={field}
          >
            <option value="svg">SVG</option>
            <option value="png">PNG</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-small font-medium">
          {t("size")}
          <select
            name="size"
            defaultValue="1024"
            disabled={pending}
            className={field}
          >
            {[128, 256, 512, 1024, 2048, 4096].map((size) => (
              <option key={size} value={size}>
                {t("pixels", { size })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-1.5 text-small text-fg-muted">
        <p>{bundle ? t("limits", { count, limit: 500 }) : t("printRules")}</p>
        {minimumMm ? (
          <p>
            {t("minimum", {
              size: formatter.number(minimumMm, { maximumFractionDigits: 1 }),
            })}
          </p>
        ) : null}
        <p>{t("expiresHint")}</p>
      </div>
      {failure ? (
        <p
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="text-small text-danger outline-none"
        >
          {t(`errors.${exportErrorKey(failure)}`)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          loading={pending}
          disabled={pending || Boolean(error) || !count}
        >
          {t(bundle ? "createZip" : "prepare")}
        </Button>
        <Link
          href={cancelHref}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
