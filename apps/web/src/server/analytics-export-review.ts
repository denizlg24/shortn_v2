import { analyticsExportInput, dimensions } from "@shortn/core";
import { parseQuery, resolveRange } from "@/components/analytics/query";
import type { LinkListQuery } from "./link-list-query";

export function analyticsExportReview(
  query: LinkListQuery,
  workspace: string,
  now = new Date(),
) {
  const one = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : undefined;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === "string") params.set(key, value);
  const defaults = parseQuery(params),
    range = resolveRange(defaults, now);
  const scope = one("campaign")
    ? { type: "campaign" as const, id: one("campaign")! }
    : one("qr")
      ? { type: "qr" as const, id: one("qr")! }
      : one("tag")
        ? { type: "tag" as const, name: one("tag")! }
        : { type: "workspace" as const };
  const requested = query.dimension,
    selected =
      typeof requested === "string"
        ? [requested]
        : (requested ?? Object.keys(dimensions));
  const input = analyticsExportInput.safeParse({
    scope,
    from: one("from") ?? range.from.toISOString(),
    to: one("to") ?? range.to.toISOString(),
    timezone: one("timezone") ?? "UTC",
    interval: one("interval") ?? defaults.interval,
    filters: Object.fromEntries(
      Object.keys(dimensions).flatMap((key) =>
        one(key) ? [[key, one(key)!]] : [],
      ),
    ),
    dimensions: selected,
    mode: "aggregate",
    format: "csv",
  });
  let back = `/${workspace}/analytics`;
  const returnTo = one("returnTo");
  if (returnTo?.startsWith(`/${workspace}/`) && !returnTo.includes("\\")) {
    const suffix = returnTo.slice(workspace.length + 2).split("?")[0];
    if (
      /^(?:analytics(?:\/[a-zA-Z]+)?|(?:links|campaigns|qr)\/[a-f\d]{24}(?:\/analytics)?)$/.test(
        suffix ?? "",
      ) &&
      !/\/(?:export|exports)$/.test(returnTo.split("?")[0]!)
    )
      back = returnTo;
  }
  return { input: input.success ? input.data : null, back };
}
