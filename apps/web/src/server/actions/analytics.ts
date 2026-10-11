"use server";

import { hasFeature, loadEntitlements } from "@shortn/billing";
import {
  breakdown,
  campaignLinks,
  clampRange,
  getLink,
  getQr,
  isDimension,
  ownedBy,
  timeseries,
  totals,
  type AnalyticsScope,
  type BreakdownRow,
  type Dimension,
  type Filters,
  type SeriesPoint,
  type Totals,
} from "@shortn/core";
import { collection, type Documents } from "@shortn/db";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { serviceContext } from "../context";
import { invalidInput, type ActionResult } from "./result";

const objectId = z.string().regex(/^[a-f0-9]{24}$/);

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
  /** Rows per breakdown; a full breakdown page asks for all of them. */
  limit: z.number().int().min(1).max(1000).default(50),
  /** Dimensions to list filter choices for, each ignoring its own filter. */
  options: z.array(z.string()).max(16).default([]),
  series: z.boolean().default(true),
  compare: z.boolean().default(true),
});

export interface AnalyticsResult {
  range: { from: string; to: string; clampedFrom: string | null };
  totals: Totals;
  previous: Totals;
  series: SeriesPoint[];
  breakdowns: Partial<Record<Dimension, BreakdownRow[]>>;
  // Breakdowns the plan doesn't include; the UI shows them as gated (06).
  gated: Dimension[];
  /** Values seen in the range, for the filter bar's selects. */
  options: Partial<Record<Dimension, string[]>>;
  linkLabels: Record<string, string>;
  /**
   * The workspace-wide filters equal to this scope, so "See all" can open the
   * full breakdown pages (e.g. a QR code is its link's scans).
   */
  scopeFilters: Record<string, string>;
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
const optionLimit = 100;
const noTotals: Totals = { clicks: 0, scans: 0, uniques: 0 };

type Ctx = Awaited<ReturnType<typeof serviceContext>>;
type ScopeInput = z.infer<typeof queryInput>["scope"];

async function resolveScope(ctx: Ctx, input: ScopeInput) {
  const scope: AnalyticsScope = { workspaceId: ctx.workspace._id };
  const filters: Filters = {};
  const scopeFilters: Record<string, string> = {};
  if (input.type === "link") {
    const link = await getLink(ctx, input.id);
    if (!link) return null;
    scope.linkIds = [new ObjectId(link.id)];
    scopeFilters.link = link.id;
  } else if (input.type === "qr") {
    const qr = await getQr(ctx, input.id);
    if (!qr) return null;
    const backing = await collection(ctx.db, "links").findOne(
      { urlCode: qr.key },
      { projection: { _id: 1 } },
    );
    scope.linkIds = backing ? [backing._id] : [];
    scope.kind = "scan";
    if (backing) scopeFilters.link = backing._id.toHexString();
    scopeFilters.kind = "scan";
  } else if (input.type === "campaign") {
    const members = await campaignLinks(ctx, input.id);
    if (!members) return null;
    scope.linkIds = members.links.map((link) => link._id);
    // Legacy counts a campaign's clicks by utm_campaign = its title.
    filters.utmCampaign = members.campaign.title;
    scopeFilters.campaign = input.id;
  }
  return { scope, filters, scopeFilters };
}

// The link and kind filters narrow the scope; a filter outside the scope
// (another link, clicks on a QR code) leaves nothing to count.
function narrow(scope: AnalyticsScope, filters: Record<string, string>) {
  const next: AnalyticsScope = { ...scope };
  const link = objectId.safeParse(filters.link);
  if (link.success) {
    const id = new ObjectId(link.data);
    next.linkIds = scope.linkIds
      ? scope.linkIds.filter((member) => member.equals(id))
      : [id];
  }
  const kind = filters.kind;
  if (kind === "click" || kind === "scan") {
    if (scope.kind && scope.kind !== kind) next.linkIds = [];
    else next.kind = kind;
  }
  return next;
}

export async function analyticsAction(
  workspace: string,
  input: z.input<typeof queryInput>,
): Promise<ActionResult<AnalyticsResult>> {
  const parsed = queryInput.safeParse(input);
  if (!parsed.success || !validZone(parsed.data.timezone)) return invalidInput;
  const q = parsed.data;
  const ctx = await serviceContext(workspace);
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);

  const resolved = await resolveScope(ctx, q.scope);
  if (!resolved) return { ok: false, error: "not_found" };
  const scope = narrow(resolved.scope, q.filters);

  const requested = {
    from: new Date(q.from),
    to: new Date(q.to),
    timezone: q.timezone,
  };
  if (!(requested.from < requested.to)) return invalidInput;
  const range = clampRange(requested, entitlements);
  const span = range.to.getTime() - range.from.getTime();
  const previousRange = clampRange(
    {
      ...range,
      from: new Date(range.from.getTime() - span),
      to: range.from,
    },
    entitlements,
  );

  const breakdownsAllowed = hasFeature(entitlements, "analyticsBreakdowns");
  const userFilters: Filters = {};
  if (breakdownsAllowed)
    for (const [key, value] of Object.entries(q.filters))
      if (isDimension(key) && !basicDimensions.has(key))
        userFilters[key] = value;
  const filters: Filters = { ...userFilters, ...resolved.filters };

  const dimensions = q.dimensions.filter(isDimension);
  const gated = breakdownsAllowed
    ? []
    : dimensions.filter((d) => !basicDimensions.has(d));
  const visible = dimensions.filter((d) => !gated.includes(d));
  const optionDimensions = breakdownsAllowed
    ? q.options.filter(
        (d): d is Dimension => isDimension(d) && !basicDimensions.has(d),
      )
    : [];

  const fetchLimit = (d: Dimension) =>
    optionDimensions.includes(d) ? Math.max(q.limit, optionLimit) : q.limit;
  const without = (d: Dimension): Filters =>
    Object.fromEntries(Object.entries(filters).filter(([key]) => key !== d));

  const [current, previous, series, rows] = await Promise.all([
    totals(ctx.db, scope, range, filters),
    !q.compare || previousRange.from >= previousRange.to
      ? Promise.resolve(noTotals)
      : totals(ctx.db, scope, previousRange, filters),
    q.series
      ? timeseries(ctx.db, scope, range, q.interval, filters)
      : Promise.resolve([]),
    Promise.all(
      visible.map(
        async (d) =>
          [
            d,
            await breakdown(ctx.db, scope, range, d, filters, fetchLimit(d)),
          ] as const,
      ),
    ),
  ]);
  const breakdowns: Partial<Record<Dimension, BreakdownRow[]>> =
    Object.fromEntries(rows);

  // A dimension's own filter would leave only the chosen value; its choices
  // come from the same query without it.
  const options = Object.fromEntries(
    await Promise.all(
      optionDimensions.map(async (d) => {
        const unfiltered =
          userFilters[d] === undefined ? breakdowns[d] : undefined;
        const source =
          unfiltered ??
          (await breakdown(ctx.db, scope, range, d, without(d), optionLimit));
        return [d, source.slice(0, optionLimit).map((row) => row.value)];
      }),
    ),
  );
  for (const d of visible)
    breakdowns[d] = (breakdowns[d] ?? []).slice(0, q.limit);

  const linkIds = [
    ...(breakdowns.link ?? []).map((row) => row.value),
    q.filters.link,
  ].flatMap((id) =>
    objectId.safeParse(id).success && id ? [new ObjectId(id)] : [],
  );
  const labels = linkIds.length
    ? await collection(ctx.db, "links")
        .find(
          {
            $and: [
              { _id: { $in: linkIds } },
              ownedBy<Documents["links"]>(ctx.workspace),
            ],
          },
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
      options,
      linkLabels: Object.fromEntries(
        labels.map((l) => [l._id.toHexString(), l.urlCode ?? l.title ?? ""]),
      ),
      scopeFilters: resolved.scopeFilters,
    },
  };
}
