"use client";
import type { PlanId } from "@shortn/billing";
import { Button } from "@shortn/ui";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { PlanGate } from "../plan-gate";
import { resolveRange, type AnalyticsQuery } from "./query";

/** Review all matching events through durable exports without a browser file fetch. */
export function ExportButton({
  workspace,
  query,
  params,
  gate,
  dimension,
}: {
  workspace: string;
  query: AnalyticsQuery;
  params: Record<string, string>;
  gate: PlanId | null;
  dimension?: string;
}) {
  const t = useTranslations("analyticsExports"),
    router = useRouter(),
    pathname = usePathname(),
    current = useSearchParams();
  if (gate)
    return (
      <PlanGate
        feature={params.campaign ? "campaignExport" : "csvExport"}
        plan={gate}
      />
    );
  return (
    <Button
      type="button"
      onClick={() => {
        const { from, to } = resolveRange(query, new Date());
        const search = new URLSearchParams({
          ...Object.fromEntries(
            Object.entries(query.filters).filter(
              (entry): entry is [string, string] => Boolean(entry[1]),
            ),
          ),
          ...params,
          from: from.toISOString(),
          to: to.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          interval: query.interval,
          returnTo: `${pathname}${current.size ? `?${current}` : ""}`,
          ...(dimension ? { dimension } : {}),
        });
        router.push(`/${workspace}/analytics/export?${search}`);
      }}
    >
      <Download aria-hidden />
      {t("entry")}
    </Button>
  );
}
