"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

const STORAGE_KEY = "shortn_redesign_notice_q4_2026";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dismissed";
  } catch {
    return false;
  }
}

export function RedesignNotice() {
  const t = useTranslations("redesign-notice");
  const storedDismissed = useSyncExternalStore(
    subscribe,
    readDismissed,
    () => true,
  );
  const [dismissedNow, setDismissedNow] = useState(false);

  if (storedDismissed || dismissedNow) return null;

  function dismiss() {
    setDismissedNow(true);
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      // Storage can be blocked; the notice then stays dismissed for this visit only.
    }
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3 pb-3 sm:pb-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex max-w-2xl items-start gap-3 rounded-md border bg-background px-4 py-2.5 text-sm text-foreground shadow-lg sm:items-center">
        <span
          aria-hidden
          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500 sm:mt-0"
        />
        <p className="flex-1 min-w-0 text-pretty">{t("message")}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="-mr-1 shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
