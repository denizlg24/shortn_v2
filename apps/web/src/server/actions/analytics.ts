"use server";

import { hasFeature, loadEntitlements } from "@shortn/billing";
import {
  breakdown,
  campaignLinks,
  clampRange,
  getLink,
  getQr,
  isDimension,
  timeseries,
  totals,
  type AnalyticsScope,
  type BreakdownRow,
  type Dimension,
  type Filters,
  type Interval,
  type SeriesPoint,
  type Totals,
} from "@shortn/core";
import { collection } from "@shortn/db";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { serviceContext } from "../context";
import { invalidInput, type ActionResult } from "./result";

const queryInput = z.object({
  scope: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("workspace") }),
      z.object({ type: z.literal("link"), id: z.string().max(24) }),
      z.object({ type: z.literal("qr"), id: z.string().max(24) }),
      z.object({ type: z.literal("campaign"), id: z.string().max(24) }),
    ])
    .default({ type: "workspace" }),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  timezone: z.string().max(64).default("UTC"),
  interval: z.enum(["hour", "day", "week", "month"]).default("day"),
  filters: z.record(z.string(), z.string().max(200)).default({}),
  dimensions: z.array(z.string()).max(16).default([]),
});

export interface AnalyticsResult {
  range: { from: string; to: string; clampedFrom: string | null };
  totals: Totals;
  previous: Totals;
  series: SeriesPoint[];
  breakdowns: Partial<Record<Dimension, BreakdownRow[]>>;
  // Breakdowns the plan doesn't include; the UI shows them as gated (06).
  gated: Dimension[];
  linkLabels: Record<string, string>;
}

const validZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

// Dimensions every plan sees; the rest need analyticsBreakdowns (legacy
// gated per-click detail to Plus and up).
const basicDimensions = new Set<Dimension>(["kind", "link"]);

export async function analyticsAction(
  workspace: string,
  input: z.input<typeof queryInput>,
): Promise<ActionResult<AnalyticsResult>> {
  const parsed = queryInput.safeParse(input);
  if (!parsed.success || !validZone(parsed.data.timezone)) return invalidInput;
  const q = parsed.data;
  const ctx = await serviceContext(workspace);
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);

  const scope: AnalyticsScope = { workspaceId: ctx.workspace._id };
  if (q.scope.type === "link") {
    const link = await getLink(ctx, q.scope.id);
    if (!link) return { ok: false, error: "not_found" };
    scope.linkIds = [new ObjectId(link.id)];
  } else if (q.scope.type === "qr") {
    const qr = await getQr(ctx, q.scope.id);
    if (!qr) return { ok: false, error: "not_found" };
    const backing = await collection(ctx.db, "links").findOne(
      { urlCode: qr.key },
      { projection: { _id: 1 } },
    );
    scope.linkIds = backing ? [backing._id] : [];
    scope.kind = "scan";
  } else if (q.scope.type === "campaign") {
    const members = await campaignLinks(ctx, q.scope.id);
    if (!members) return { ok: false, error: "not_found" };
    scope.linkIds = members.links.map((link) => link._id);
  }

  const requested = {
    from: new Date(q.from),
    to: new Date(q.to),
    timezone: q.timezone,
  };
  if (!(requested.from < requested.to)) return invalidInput;
  const range = clampRange(requested, entitlements);
  const span = range.to.getTime() - range.from.getTime();
  const previousRange = {
    ...range,
    from: new Date(range.from.getTime() - span),
    to: range.from,
  };
  const filters: Filters = {};
  for (const [key, value] of Object.entries(q.filters))
    if (isDimension(key)) filters[key] = value;
  if (q.scope.type === "campaign") {
    const campaign = await collection(ctx.db, "campaigns").findOne({
      _id: new ObjectId(q.scope.id),
    });
    // Legacy counts a campaign's clicks by utm_campaign = its title.
    if (campaign) filters.utmCampaign = campaign.title;
  }

  const breakdownsAllowed = hasFeature(entitlements, "analyticsBreakdowns");
  const dimensions = q.dimensions.filter(isDimension);
  const gated = breakdownsAllowed
    ? []
    : dimensions.filter((d) => !basicDimensions.has(d));
  const visible = dimensions.filter((d) => !gated.includes(d));
  const usedFilters = breakdownsAllowed ? filters : {};

  const [current, previous, series, rows] = await Promise.all([
    totals(ctx.db, scope, range, usedFilters),
    clampRange(previousRange, entitlements).from >= previousRange.to
      ? Promise.resolve({ clicks: 0, scans: 0, uniques: 0 })
      : totals(
          ctx.db,
          scope,
          clampRange(previousRange, entitlements),
          usedFilters,
        ),
    timeseries(ctx.db, scope, range, q.interval as Interval, usedFilters),
    Promise.all(
      visible.map(
        async (d) =>
          [d, await breakdown(ctx.db, scope, range, d, usedFilters)] as const,
      ),
    ),
  ]);
  const breakdowns: Partial<Record<Dimension, BreakdownRow[]>> =
    Object.fromEntries(rows);

  const linkIds = (breakdowns.link ?? []).flatMap((row) =>
    ObjectId.isValid(row.value) ? [new ObjectId(row.value)] : [],
  );
  const labels = linkIds.length
    ? await collection(ctx.db, "links")
        .find(
          { _id: { $in: linkIds } },
          { projection: { urlCode: 1, title: 1 } },
        )
        .toArray()
    : [];

  return {
    ok: true,
    data: {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        clampedFrom:
          range.from > requested.from ? range.from.toISOString() : null,
      },
      totals: current,
      previous,
      series,
      breakdowns,
      gated,
      linkLabels: Object.fromEntries(
        labels.map((l) => [l._id.toHexString(), l.urlCode ?? l.title ?? ""]),
      ),
    },
  };
}
