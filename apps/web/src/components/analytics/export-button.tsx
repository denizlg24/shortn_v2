"use client";

import type { PlanId } from "@shortn/billing";
import { Button } from "@shortn/ui";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PlanGate } from "../plan-gate";
import { downloadText } from "./csv";
import { resolveRange, type AnalyticsQuery } from "./query";

const fileName = (disposition: string | null, fallback: string) =>
  disposition?.match(/filename="([^"]+)"/)?.[1] ?? fallback;

/** Downloads the raw events behind the current range and filters (csvExport). */
export function ExportButton({
  workspace,
  query,
  params,
  gate,
}: {
  workspace: string;
  query: AnalyticsQuery;
  /** Scope of the export, e.g. `{ campaign: id }`. */
  params: Record<string, string>;
  gate: PlanId | null;
}) {
  const t = useTranslations("analytics.export");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gate)
    return (
      <PlanGate
        feature={params.campaign ? "campaignExport" : "csvExport"}
        plan={gate}
      />
    );

  const download = async () => {
    setPending(true);
    setError(null);
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
    });
    try {
      const response = await fetch(`/api/export/${workspace}?${search}`);
      if (!response.ok) throw new Error(String(response.status));
      downloadText(
        await response.text(),
        fileName(
          response.headers.get("content-disposition"),
          "shortn-export.csv",
        ),
        "text/csv;charset=utf-8",
      );
    } catch {
      setError(t("failed"));
    }
    setPending(false);
  };

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <Button loading={pending} onClick={download}>
        {pending ? null : <Download aria-hidden />}
        {t("label")}
      </Button>
    </div>
  );
}
