"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shortn/ui";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Options } from "qr-code-styling";
import { useState } from "react";
import { downloadQr, scaled } from "./qr-render";

const sizes = [512, 1024, 2048] as const;
const formats = ["svg", "png", "jpeg"] as const;
type Format = (typeof formats)[number];

/** Exports what the preview shows, at a print-friendly size. */
export function QrDownloadMenu({
  options,
  name,
}: {
  options: Options;
  /** File name without extension, e.g. the code's public id. */
  name: string;
}) {
  const t = useTranslations("qr.download");
  const [size, setSize] = useState<number>(1024);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (format: Format) => {
    setPending(true);
    setError(null);
    const result = await downloadQr(scaled(options, size), format, name);
    setPending(false);
    if (result === "logo_failed") setError(t("logoFailed"));
    else if (result === "failed") setError(t("failed"));
  };

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <p role="alert" className="text-small text-danger max-md:sr-only">
          {error}
        </p>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button loading={pending}>
            {pending ? null : <Download aria-hidden />}
            <span className="max-sm:sr-only">{t("label")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("size")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(size)}
            onValueChange={(value) => setSize(Number(value))}
          >
            {sizes.map((option) => (
              <DropdownMenuRadioItem
                key={option}
                value={String(option)}
                onSelect={(event) => event.preventDefault()}
                className="font-mono tabular-nums"
              >
                {t("pixels", { size: option })}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          {formats.map((format) => (
            <DropdownMenuItem key={format} onSelect={() => void run(format)}>
              {t(`formats.${format}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
