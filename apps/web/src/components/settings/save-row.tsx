"use client";

import { Button } from "@shortn/ui";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** Save per section (12 §Settings); "Saved" stays until the next edit. */
export function SaveRow({
  saved,
  pending,
  disabled,
  disabledReason,
  label,
}: {
  saved: boolean;
  pending: boolean;
  disabled?: boolean;
  disabledReason?: ReactNode;
  label?: string;
}) {
  const t = useTranslations("settings.common");
  return (
    <div className="flex items-center gap-3">
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        disabled={disabled && !disabledReason}
        {...(disabledReason ? { disabledReason } : {})}
      >
        {label ?? t("save")}
      </Button>
      <p
        role="status"
        className="flex items-center gap-1.5 text-small text-fg-muted"
      >
        {saved ? (
          <>
            <Check aria-hidden className="size-4 text-success" />
            {t("saved")}
          </>
        ) : null}
      </p>
    </div>
  );
}
