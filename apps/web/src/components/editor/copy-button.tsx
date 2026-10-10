"use client";

import { announce, Button, copyText, type ButtonProps } from "@shortn/ui";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

const copiedMs = 2000;

/** Copies `text`; the icon turns into a check while the copy is fresh. */
export function CopyButton({
  text,
  label,
  children,
  variant = "ghost",
  size,
  disabled,
  className,
}: {
  text: string;
  /** Accessible name and tooltip, e.g. "Copy URL". */
  label: string;
  /** Visible text; without it the button is icon-only. */
  children?: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyText(text);
    announce(ok ? t("copied") : t("copyFailed"));
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), copiedMs);
  };

  const icon = copied ? (
    <Check aria-hidden className="text-success" />
  ) : (
    <Copy aria-hidden />
  );
  return (
    <Button
      variant={variant}
      size={size ?? (children ? "md" : "icon-sm")}
      disabled={disabled}
      onClick={copy}
      className={className}
      {...(children ? {} : { "aria-label": label, tooltip: label })}
    >
      {icon}
      {children}
    </Button>
  );
}
