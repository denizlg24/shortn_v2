"use client";

import type { PlanId } from "@shortn/billing";
import { cn } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import {
  isGatedFeature,
  type GatedFeature,
  type PlanFeatures,
} from "@/lib/plan-features";
import type { ActionResult } from "@/server/actions/result";
import { PlanGate, UpgradeLink } from "../plan-gate";

export type ErrorField = "url" | "key" | "password" | "utm" | "form";

export type FormError =
  | { field: ErrorField; kind: "message"; message: string; upgrade?: boolean }
  | { field: ErrorField; kind: "gate"; feature: GatedFeature; plan: PlanId };

export type ActionFailure = Extract<ActionResult<null>, { ok: false }>;

export const networkFailure: ActionFailure = { ok: false, error: "network" };

const gateField: Record<GatedFeature, ErrorField> = {
  customKeys: "key",
  passwords: "password",
  campaigns: "utm",
  analyticsBreakdowns: "form",
};

/** Maps a server action failure to the field it belongs to and a localized message. */
export function useFormError(features: PlanFeatures) {
  const t = useTranslations("links.errors");
  return useCallback(
    (
      failure: ActionFailure,
      context: { key?: string; fallback?: ErrorField } = {},
    ): FormError => {
      const message = (
        field: ErrorField,
        text: string,
        upgrade = false,
      ): FormError => ({ field, kind: "message", message: text, upgrade });
      const key = String(failure.detail?.key ?? context.key ?? "");
      switch (failure.error) {
        case "invalid_url":
          return message("url", t("invalidUrl"));
        case "unsafe_destination":
          return message("url", t("unsafeDestination"));
        case "invalid_key":
          return message("key", t("invalidKey"));
        case "key_reserved":
          return message("key", t("keyReserved", { key }));
        case "key_taken":
          return message("key", t("keyTaken", { key }));
        case "feature_required": {
          const feature = failure.detail?.feature;
          if (!isGatedFeature(feature)) return message("form", t("generic"));
          return {
            field: gateField[feature],
            kind: "gate",
            feature,
            plan: features[feature].plan,
          };
        }
        case "limit_reached":
          return message(
            "form",
            t("limitReached", { limit: Number(failure.detail?.limit ?? 0) }),
            true,
          );
        case "forbidden":
          return message("form", t("forbidden"));
        case "not_found":
          return message("form", t("notFound"));
        case "invalid_input":
          return message(context.fallback ?? "form", t("invalidInput"));
        case "network":
          return message("form", t("network"));
        default:
          return message("form", t("generic"));
      }
    },
    [t, features],
  );
}

export function FormErrorText({
  error,
  className,
}: {
  error: FormError;
  className?: string | undefined;
}) {
  if (error.kind === "gate")
    return (
      <PlanGate
        feature={error.feature}
        plan={error.plan}
        className={className}
      />
    );
  return (
    <p role="alert" className={cn("text-meta text-danger", className)}>
      {error.message}
      {error.upgrade ? (
        <>
          {" "}
          <UpgradeLink />
        </>
      ) : null}
    </p>
  );
}
