"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function PaymentRetry() {
  const t = useTranslations("billing.invoices");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="cursor-pointer font-medium text-signal hover:underline disabled:opacity-50"
    >
      {t("retry")}
    </button>
  );
}
