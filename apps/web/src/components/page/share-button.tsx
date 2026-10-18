"use client";

import { buttonVariants, copyText } from "@shortn/ui";
import { Check, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Share the public URL; desktop browsers without Web Share copy it instead. */
export function ShareButton({
  url,
  title,
}: {
  url: string;
  title?: string | undefined;
}) {
  const t = useTranslations("page.share");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [pending, setPending] = useState(false);

  const share = async () => {
    setPending(true);
    setStatus("idle");
    try {
      if (navigator.share) {
        try {
          await navigator.share({ url, ...(title ? { title } : {}) });
          return;
        } catch (error) {
          // Dismissing the system share sheet is a completed user choice.
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }
      setStatus((await copyText(url)) ? "copied" : "failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={share}
        className={buttonVariants({ variant: "secondary", size: "md" })}
      >
        {status === "copied" ? <Check aria-hidden /> : <Share2 aria-hidden />}
        {t("label")}
      </button>
      <span role="status" className="text-small text-fg-muted">
        {status === "copied"
          ? t("copied")
          : status === "failed"
            ? t("failed")
            : null}
      </span>
    </span>
  );
}
