"use client";

import { buttonVariants, cn } from "@shortn/ui";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Options } from "qr-code-styling";
import { useId, useState } from "react";
import { downloadQr, scaled } from "./qr-render";

const sizes = [512, 1024, 2048] as const;
const formats = ["png", "svg", "jpeg"] as const;
type Format = (typeof formats)[number];

/** Exports the code as printed, at a print-friendly size. */
export function QrDownloads({
  options,
  name,
}: {
  options: Options;
  /** File name without extension, e.g. the code's public id. */
  name: string;
}) {
  const t = useTranslations("qr.download");
  const id = useId();
  const [size, setSize] = useState<number>(1024);
  const [pending, setPending] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (format: Format) => {
    setPending(format);
    setError(null);
    const result = await downloadQr(scaled(options, size), format, name);
    setPending(null);
    if (result === "logo_failed") setError(t("logoFailed"));
    else if (result === "failed") setError(t("failed"));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${id}-size`}
            className="text-meta font-medium text-fg-muted"
          >
            {t("size")}
          </label>
          <select
            id={`${id}-size`}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
            className="h-8 rounded-control border border-line-strong bg-field px-2.5 pr-7 font-mono text-small text-fg tabular-nums focus-visible:outline-2 focus-visible:outline-signal"
          >
            {sizes.map((option) => (
              <option key={option} value={option}>
                {t("pixels", { size: option })}
              </option>
            ))}
          </select>
        </div>
        {formats.map((format) => (
          <button
            key={format}
            type="button"
            disabled={pending !== null}
            aria-busy={pending === format || undefined}
            onClick={() => void run(format)}
            className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
          >
            <Download aria-hidden />
            {t(`formats.${format}`)}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
