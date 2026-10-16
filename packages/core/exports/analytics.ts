import { hasFeature } from "@shortn/billing";
import { collection } from "@shortn/db";
import type { Document } from "mongodb";
import { z } from "zod";
import {
  analyticsQueryInput,
  resolveAnalyticsExportScope,
} from "../analytics/service";
import {
  analyticsExportMatch,
  clampRange,
  type Dimension,
} from "../analytics/queries";
import { csvCell } from "../imports/csv";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { analyticsAggregateRows } from "./analytics-aggregate";
import { authorizeLinkExport, LinkExportError } from "./links";

export const analyticsExportInput = analyticsQueryInput
  .pick({
    scope: true,
    from: true,
    to: true,
    timezone: true,
    interval: true,
    filters: true,
    dimensions: true,
  })
  .extend({
    mode: z.enum(["aggregate", "raw"]),
    format: z.enum(["csv", "ndjson"]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.from) >= new Date(value.to))
      ctx.addIssue({ code: "custom", message: "Invalid range" });
    if (value.mode === "aggregate" && value.format !== "csv")
      ctx.addIssue({ code: "custom", message: "Aggregates require CSV" });
    try {
      new Intl.DateTimeFormat("en", { timeZone: value.timezone });
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid timezone" });
    }
  });
export type AnalyticsExportInput = z.output<typeof analyticsExportInput>;

/** Request-time window is stable; current entitlement and ownership remain live. */
export async function resolveAnalyticsExport(
  ctx: ServiceContext,
  input: AnalyticsExportInput,
  capturedAt = nowOf(ctx),
) {
  const workspace = await authorizeLinkExport(
    ctx,
    input.scope.type === "campaign",
  );
  const resolved = await resolveAnalyticsExportScope(
    { ...ctx, workspace },
    input.scope,
    input.filters,
  );
  if (!resolved) throw new LinkExportError("forbidden");
  const range = clampRange(
    {
      from: new Date(input.from),
      to: new Date(
        Math.min(new Date(input.to).getTime(), capturedAt.getTime()),
      ),
      timezone: input.timezone,
    },
    resolved.entitlements,
    capturedAt,
  );
  return { ...resolved, range };
}

export const rawAnalyticsColumns = [
  "timestamp",
  "kind",
  "key",
  "country",
  "city",
  "continent",
  "device",
  "browser",
  "os",
  "referrer",
  "language",
  "branch",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
export const aggregateAnalyticsColumns = [
  "section",
  "dimension",
  "value",
  "period",
  "clicks",
  "scans",
  "uniques",
] as const;
const text = (value: unknown) => (typeof value === "string" ? value : "");
/** Explicit DTO excludes event IDs, tenant/actor IDs, IP hashes and user agents. */
export function rawAnalyticsRecord(
  doc: Document,
): Record<(typeof rawAnalyticsColumns)[number], string> {
  return {
    timestamp: doc.ts.toISOString(),
    kind: text(doc.m?.kind),
    key: text(doc.m?.key),
    country: text(doc.country),
    city: text(doc.city),
    continent: text(doc.continent),
    device: text(doc.device),
    browser: text(doc.browser),
    os: text(doc.os),
    referrer: text(doc.refDomain),
    language: text(doc.lang),
    branch: text(doc.m?.branch),
    utm_source: text(doc.utm?.source),
    utm_medium: text(doc.utm?.medium),
    utm_campaign: text(doc.utm?.campaign),
    utm_term: text(doc.utm?.term),
    utm_content: text(doc.utm?.content),
  };
}
/** Every cursor is batched, backpressured and closed on EOF/error/cancellation. */
export async function* streamAnalyticsExport(
  ctx: ServiceContext,
  input: AnalyticsExportInput,
  capturedAt = nowOf(ctx),
  signal?: AbortSignal,
  onRows?: (done: number) => Promise<void>,
  window?: { from: string; to: string },
): AsyncGenerator<Uint8Array> {
  const parsed = analyticsExportInput.safeParse(input);
  if (!parsed.success) throw new LinkExportError("invalid_export");
  input = parsed.data;
  const resolved = await resolveAnalyticsExport(ctx, input, capturedAt),
    { scope, filters } = resolved;
  const range = {
    ...resolved.range,
    ...(window
      ? {
          from: new Date(
            Math.max(
              resolved.range.from.getTime(),
              new Date(window.from).getTime(),
            ),
          ),
          to: new Date(
            Math.min(
              resolved.range.to.getTime(),
              new Date(window.to).getTime(),
            ),
          ),
        }
      : {}),
  };
  const predicate = analyticsExportMatch(scope, range, filters),
    encoder = new TextEncoder();
  const columns =
    input.mode === "raw" ? rawAnalyticsColumns : aggregateAnalyticsColumns;
  let done = 0;
  const check = async () => {
    if (signal?.aborted) throw new LinkExportError("export_cancelled");
    const live = await resolveAnalyticsExport(ctx, input, capturedAt);
    // A plan downgrade or membership-of-scope change must not expose a cursor's
    // old, broader selection. Abort rather than publish a partial artifact.
    if (
      live.range.from > range.from ||
      JSON.stringify(live.scope) !== JSON.stringify(scope) ||
      JSON.stringify(live.filters) !== JSON.stringify(filters)
    )
      throw new LinkExportError("forbidden");
    await onRows?.(done);
  };
  const encode = (row: Record<string, unknown>) =>
    encoder.encode(
      input.format === "ndjson"
        ? `${JSON.stringify(row)}\n`
        : `${columns.map((key) => csvCell(String(row[key] ?? ""))).join(",")}\r\n`,
    );
  const session = ctx.db.client.startSession({ snapshot: true });
  try {
    await check();
    if (input.format === "csv")
      yield encoder.encode(`${columns.join(",")}\r\n`);
    if (range.from >= range.to) {
      if (input.mode === "aggregate") {
        yield encode({ section: "total", clicks: 0, scans: 0, uniques: 0 });
        done++;
      }
      await check();
      return;
    }
    if (input.mode === "raw") {
      const cursor = collection(ctx.db, "click_events")
        .find(predicate, {
          projection: {
            _id: 0,
            ts: 1,
            "m.kind": 1,
            "m.key": 1,
            "m.branch": 1,
            country: 1,
            city: 1,
            continent: 1,
            device: 1,
            browser: 1,
            os: 1,
            refDomain: 1,
            lang: 1,
            utm: 1,
          },
          batchSize: 500,
          session,
          signal,
        })
        .sort({ ts: 1, _id: 1 });
      try {
        for await (const doc of cursor) {
          if (signal?.aborted) throw new LinkExportError("export_cancelled");
          yield encode(rawAnalyticsRecord(doc));
          done++;
          if (done % 500 === 0) await check();
        }
      } finally {
        await cursor.close();
      }
    } else {
      const allowed = hasFeature(resolved.entitlements, "analyticsBreakdowns");
      const selected = (input.dimensions as Dimension[]).filter(
        (dimension) => allowed || dimension === "kind" || dimension === "link",
      );
      for await (const row of analyticsAggregateRows(
        ctx.db,
        predicate,
        { ...input, dimensions: selected },
        session,
        check,
        signal,
      )) {
        yield encode({ ...row });
        done++;
        if (done % 500 === 0) await check();
      }
    }
    await check();
  } catch (error) {
    if (signal?.aborted) throw new LinkExportError("export_cancelled");
    throw error;
  } finally {
    await session.endSession();
  }
}
