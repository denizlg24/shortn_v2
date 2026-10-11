import { hasFeature, loadEntitlements } from "@shortn/billing";
import {
  campaignLinks,
  clampRange,
  exportCursor,
  getLink,
  type AnalyticsScope,
  type Filters,
} from "@shortn/core";
import { ObjectId } from "mongodb";
import { serviceContext } from "@/server/context";

export const dynamic = "force-dynamic";

const columns = [
  "timestamp",
  "kind",
  "key",
  "country",
  "city",
  "device",
  "browser",
  "os",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

// Quotes every field and defuses spreadsheet formulas (=, +, -, @).
const cell = (value: string | undefined) => {
  const text = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

// Attribute filters the analytics filter bar puts in the URL.
const filterParams = [
  "country",
  "device",
  "browser",
  "os",
  "referrer",
  "utmSource",
  "utmMedium",
  "utmCampaign",
] as const;

// GET /api/export/{ws}?from&to[&link=id|&campaign=id][&kind][&country…] →
// CSV of raw events in the plan's analytics window (csvExport feature).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspace: string }> },
) {
  const { workspace } = await params;
  const ctx = await serviceContext(workspace);
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") ?? "");
  const to = new Date(url.searchParams.get("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to)
    return Response.json({ error: "invalid_range" }, { status: 400 });
  const scope: AnalyticsScope = { workspaceId: ctx.workspace._id };
  const filters: Filters = {};
  const linkId = url.searchParams.get("link");
  const campaignId = url.searchParams.get("campaign");
  // Campaign export stays Pro, as in legacy; other exports are Plus (csvExport).
  const feature = campaignId ? "campaignExport" : "csvExport";
  if (!hasFeature(entitlements, feature))
    return Response.json(
      { error: "feature_required", feature },
      { status: 403 },
    );
  let campaignTitle: string | null = null;
  if (campaignId) {
    const members = await campaignLinks(ctx, campaignId);
    if (!members) return Response.json({ error: "not_found" }, { status: 404 });
    scope.linkIds = members.links.map((link) => link._id);
    campaignTitle = members.campaign.title;
  }
  if (linkId) {
    const link = await getLink(ctx, linkId);
    if (!link) return Response.json({ error: "not_found" }, { status: 404 });
    const id = new ObjectId(link.id);
    scope.linkIds = scope.linkIds
      ? scope.linkIds.filter((member) => member.equals(id))
      : [id];
  }
  const kind = url.searchParams.get("kind");
  if (kind === "click" || kind === "scan") scope.kind = kind;
  if (hasFeature(entitlements, "analyticsBreakdowns"))
    for (const name of filterParams) {
      const value = url.searchParams.get(name)?.slice(0, 200);
      if (value) filters[name] = value;
    }
  // Legacy counts a campaign's clicks by utm_campaign = its title.
  if (campaignTitle !== null) filters.utmCampaign = campaignTitle;
  const range = clampRange({ from, to, timezone: "UTC" }, entitlements);
  const cursor = exportCursor(ctx.db, scope, range, filters);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`${columns.join(",")}\n`));
      for await (const row of cursor)
        controller.enqueue(
          encoder.encode(
            [
              row.ts.toISOString(),
              row.kind,
              row.key,
              row.country,
              row.city,
              row.device,
              row.browser,
              row.os,
              row.referrer,
              row.utmSource,
              row.utmMedium,
              row.utmCampaign,
              row.utmTerm,
              row.utmContent,
            ]
              .map(cell)
              .join(",") + "\n",
          ),
        );
      controller.close();
    },
    async cancel() {
      await cursor.close();
    },
  });
  const name = `shortn-${ctx.workspace.slug}-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
