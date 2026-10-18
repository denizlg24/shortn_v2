import { hasFeature, loadEntitlements } from "@shortn/billing";
import { collection, type Documents } from "@shortn/db";
import { ObjectId } from "mongodb";
import { z } from "zod";
import {
  breakdown,
  bucketStarts,
  clampRange,
  isDimension,
  timeseries,
  totals,
  type AnalyticsScope,
  type BreakdownRow,
  type Dimension,
  type Filters,
  type SeriesPoint,
  type Totals,
} from "./queries";
import { campaignLinks } from "../campaigns/service";
import { getLink } from "../links/service";
import { getQr } from "../qr/service";
import { ownedBy } from "../workspaces/service";
import { can } from "../workspaces/authz";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { fail, type Result } from "../result";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const dimensionInput = z
  .string()
  .refine((value): boolean => isDimension(value), "Invalid dimension");

export const analyticsQueryInput = z.object({
  scope: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("workspace") }),
      z.object({ type: z.literal("link"), id: z.string().max(24) }),
      z.object({ type: z.literal("qr"), id: z.string().max(24) }),
      z.object({ type: z.literal("campaign"), id: z.string().max(24) }),
      z.object({ type: z.literal("tag"), name: z.string().min(1).max(48) }),
    ])
    .default({ type: "workspace" }),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  timezone: z.string().max(64).default("UTC"),
  interval: z.enum(["hour", "day", "week", "month"]).default("day"),
  filters: z
    .record(dimensionInput, z.string().min(1).max(200))
    .superRefine((filters, ctx) => {
      if (filters.link && !objectId.safeParse(filters.link).success)
        ctx.addIssue({
          code: "custom",
          message: "Invalid link ID",
          path: ["link"],
        });
      if (filters.kind && filters.kind !== "click" && filters.kind !== "scan")
        ctx.addIssue({
          code: "custom",
          message: "Invalid event kind",
          path: ["kind"],
        });
    })
    .default({}),
  dimensions: z.array(dimensionInput).max(16).default([]),
  /** Rows per breakdown; a full breakdown page asks for all of them. */
  limit: z.number().int().min(1).max(1000).default(50),
  /** Dimensions to list filter choices for, each ignoring its own filter. */
  options: z.array(dimensionInput).max(16).default([]),
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

type Ctx = ServiceContext;
type ScopeInput = z.infer<typeof analyticsQueryInput>["scope"];

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
      {
        $and: [{ urlCode: qr.key }, ownedBy<Documents["links"]>(ctx.workspace)],
      },
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
  } else if (input.type === "tag") {
    const links = await collection(ctx.db, "links")
      .find(
        {
          $and: [
            ownedBy<Documents["links"]>(ctx.workspace),
            { "tags.tagName": input.name, deletedAt: { $exists: false } },
          ],
        },
        { projection: { _id: 1 } },
      )
      .toArray();
    scope.linkIds = links.map((link) => link._id);
    scopeFilters.tag = input.name;
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

/** Export workers resolve the same owned scope and plan-gated filters as views. */
export async function resolveAnalyticsExportScope(
  ctx: ServiceContext,
  input: ScopeInput,
  filters: Record<string, string>,
) {
  const resolved = await resolveScope(ctx, input);
  if (!resolved) return null;
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const allowed: Filters = {};
  if (hasFeature(entitlements, "analyticsBreakdowns"))
    for (const [key, value] of Object.entries(filters))
      if (isDimension(key) && !basicDimensions.has(key)) allowed[key] = value;
  return {
    scope: narrow(resolved.scope, filters),
    filters: { ...allowed, ...resolved.filters },
    entitlements,
  };
}

export async function queryAnalytics(
  ctx: ServiceContext,
  input: z.input<typeof analyticsQueryInput>,
): Promise<
  Result<AnalyticsResult, "invalid_input" | "not_found" | "forbidden">
> {
  const parsed = analyticsQueryInput.safeParse(input);
  if (!parsed.success || !validZone(parsed.data.timezone))
    return fail("invalid_input");
  const q = parsed.data;
  if (!can(ctx.actor, "workspace.view")) return fail("forbidden");
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);

  const resolved = await resolveScope(ctx, q.scope);
  if (!resolved) return { ok: false, error: "not_found" };
  const scope = narrow(resolved.scope, q.filters);

  const requested = {
    from: new Date(q.from),
    to: new Date(q.to),
    timezone: q.timezone,
  };
  if (!(requested.from < requested.to)) return fail("invalid_input");
  const range = clampRange(requested, entitlements, nowOf(ctx));
  // bucketStarts caps its output at 2,000. Refuse that boundary instead of
  // silently returning a truncated series to dashboard or API callers.
  if (q.series && bucketStarts(range, q.interval).length >= 2000)
    return fail("invalid_input");
  const span = Math.max(0, range.to.getTime() - range.from.getTime());
  const previousRange = clampRange(
    {
      ...range,
      from: new Date(range.from.getTime() - span),
      to: range.from,
    },
    entitlements,
    nowOf(ctx),
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
    q.series && range.from < range.to
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
    value: {
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
