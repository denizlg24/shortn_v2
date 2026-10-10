"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

const STORAGE_KEY = "shortn_new_dashboard_notice";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readDismissed() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "dismissed";
  } catch {
    return false;
  }
}

// P4 beta (14): an opt-in hop to app.shortn.at through /api/handoff, which
// keeps the user signed in. Dismissal lasts for the browser session only.
export function NewDashboardNotice() {
  const t = useTranslations("new-dashboard");
  const pathname = usePathname();
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
      sessionStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      // Storage can be blocked; the notice then stays hidden for this view only.
    }
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-14 z-[90] flex justify-center px-3 pointer-events-none"
    >
      <div className="pointer-events-auto flex max-w-2xl items-center gap-3 rounded-md border bg-background px-4 py-2 text-sm text-foreground shadow-lg">
        <p className="flex-1 min-w-0 text-pretty">{t("message")}</p>
        <a
          href={`/api/handoff?from=${encodeURIComponent(pathname)}`}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("open")}
        </a>
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
