"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Notice } from "@/components/page/notice";
import { useSettledRefresh } from "./use-settled-refresh";

/** Back from Polar: the plan shows once its webhook lands, seconds later. */
export function CheckoutReturn({
  waiting,
  message,
}: {
  waiting: boolean;
  message: string;
}) {
  const t = useTranslations("billing.status");
  const refreshSettled = useSettledRefresh();
  useEffect(() => {
    if (waiting) refreshSettled();
  }, [waiting, refreshSettled]);
  return (
    <Notice tone={waiting ? "info" : "success"}>
      {message}{" "}
      {waiting ? (
        <button
          type="button"
          onClick={refreshSettled}
          className="cursor-pointer font-medium text-signal hover:underline"
        >
          {t("refresh")}
        </button>
      ) : null}
    </Notice>
  );
}
