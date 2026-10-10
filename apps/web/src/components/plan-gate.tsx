"use client";

import type { PlanId } from "@shortn/billing";
import { cn } from "@shortn/ui";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import type { GatedFeature } from "@/lib/plan-features";
import { useShell } from "./shell/shell-context";

export const billingHref = (workspace: string) =>
  `/${workspace}/settings/billing` as const;

export function UpgradeLink({ className }: { className?: string }) {
  const t = useTranslations("gate");
  const { workspace } = useShell();
  return (
    <Link
      href={billingHref(workspace.slug)}
      className={cn(
        "font-medium whitespace-nowrap text-signal underline-offset-2 hover:underline",
        className,
      )}
    >
      {t("cta")}
    </Link>
  );
}

/** 12 PlanGate: an inline explanation plus the way to upgrade, never a modal. */
export function PlanGate({
  feature,
  plan,
  className,
}: {
  feature: GatedFeature;
  plan: PlanId;
  className?: string | undefined;
}) {
  const t = useTranslations("gate");
  return (
    <GateNote className={className}>
      {t(feature, { plan: t(`plans.${plan}`) })} <UpgradeLink />
    </GateNote>
  );
}

export function GateNote({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-small text-pretty text-fg-muted",
        className,
      )}
    >
      <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
