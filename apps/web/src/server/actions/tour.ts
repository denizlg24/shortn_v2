"use server";

import {
  domainAllowance,
  listBioPages,
  listDomains,
  listLinks,
  pageQrs,
} from "@shortn/core";
import type { TourTargets } from "@/lib/tour/steps";
import { serviceContext } from "../context";

export interface TourData {
  targets: TourTargets;
  domainAllowance: number;
}

/** The newest link, QR code and bio page give the tour real detail pages to open. */
export async function tourDataAction(workspace: string): Promise<TourData> {
  const ctx = await serviceContext(workspace);
  const [links, qrs, pages, allowance, domains] = await Promise.all([
    listLinks(ctx, { limit: 1 }),
    pageQrs(ctx, { page: 1, limit: 1 }),
    listBioPages(ctx),
    domainAllowance(ctx.db, ctx.workspace._id),
    listDomains(ctx),
  ]);
  // Same rule as the domains page: active domains use up add-on slots.
  const used = domains.filter((domain) => domain.status !== "disabled").length;
  return {
    targets: {
      link: links.links[0]?.id ?? null,
      qr: qrs.items[0]?.id ?? null,
      bio: pages[0]?.id ?? null,
    },
    domainAllowance: Math.max(0, allowance - used),
  };
}
