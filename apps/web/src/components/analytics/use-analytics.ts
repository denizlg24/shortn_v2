import type { Dimension } from "@shortn/core";
import { useCallback, useEffect, useState } from "react";
import {
  analyticsAction,
  type AnalyticsResult,
} from "@/server/actions/analytics";
import type { ActionResult } from "@/server/actions/result";
import { resolveRange, type AnalyticsQuery } from "./query";

export type AnalyticsScope =
  { type: "workspace" } | { type: "link" | "qr" | "campaign"; id: string };

/** Pass a memoized object: a new identity triggers a new request. */
export interface AnalyticsRequest {
  scope: AnalyticsScope;
  query: AnalyticsQuery;
  dimensions: Dimension[];
  /** Rows per breakdown. */
  limit?: number;
  /** Dimensions whose values the filter bar lists. */
  options?: Dimension[];
  /** Skip the time series and the previous-period totals (breakdown pages). */
  totalsOnly?: boolean;
}

export type AnalyticsStatus = "loading" | "ready" | "error";

interface Settled {
  request: AnalyticsRequest;
  attempt: number;
  result: ActionResult<AnalyticsResult>;
}

export function useAnalytics(workspace: string, request: AnalyticsRequest) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [lastGood, setLastGood] = useState<AnalyticsResult | null>(null);

  useEffect(() => {
    let live = true;
    const { from, to } = resolveRange(request.query, new Date());
    const filters = Object.fromEntries(
      Object.entries(request.query.filters).filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      ),
    );
    analyticsAction(workspace, {
      scope: request.scope,
      from: from.toISOString(),
      to: to.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      interval: request.query.interval,
      filters,
      dimensions: request.dimensions,
      ...(request.limit ? { limit: request.limit } : {}),
      options: request.options ?? [],
      series: !request.totalsOnly,
      compare: !request.totalsOnly,
    }).then(
      (result) => {
        if (!live) return;
        setSettled({ request, attempt, result });
        if (result.ok) setLastGood(result.data);
      },
      () => {
        if (live)
          setSettled({
            request,
            attempt,
            result: { ok: false, error: "network" },
          });
      },
    );
    return () => {
      live = false;
    };
  }, [workspace, request, attempt]);

  const current =
    settled !== null &&
    settled.request === request &&
    settled.attempt === attempt;
  const status: AnalyticsStatus = !current
    ? "loading"
    : settled.result.ok
      ? "ready"
      : "error";

  return {
    status,
    /** The latest successful result, kept on screen while the next one loads. */
    data: current && settled.result.ok ? settled.result.data : lastGood,
    retry: useCallback(() => setAttempt((value) => value + 1), []),
  };
}
