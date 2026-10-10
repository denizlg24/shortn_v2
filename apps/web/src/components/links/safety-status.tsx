"use client";

import type { LinkView } from "@shortn/core";
import { cn } from "@shortn/ui";
import { useTranslations } from "next-intl";

const statuses = [
  "pending",
  "safe",
  "suspicious",
  "malicious",
  "blocked",
] as const;

/** Link health in words; color only marks the states that need attention. */
export function SafetyStatus({
  safety,
  className,
}: {
  safety: LinkView["safety"];
  className?: string | undefined;
}) {
  const t = useTranslations("links.safety");
  const status = statuses.find((option) => option === safety.status);
  const label = safety.disabled
    ? t("disabled")
    : status
      ? t(status)
      : safety.status;
  const tone = safety.disabled
    ? "danger"
    : status === "malicious" || status === "blocked"
      ? "danger"
      : status === "suspicious"
        ? "warning"
        : "neutral";
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-baseline gap-x-1.5",
        tone === "danger" && "text-danger",
        tone === "warning" && "text-warning",
        className,
      )}
    >
      {label}
      {safety.interstitial && !safety.disabled ? (
        <span className="text-fg-muted">· {t("interstitial")}</span>
      ) : null}
    </span>
  );
}
