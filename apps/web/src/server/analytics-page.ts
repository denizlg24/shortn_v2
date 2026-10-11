import "server-only";
import { getLink } from "@shortn/core";
import type { LinkOption } from "@/components/analytics/analytics-filters";
import { serviceContext } from "./context";

// The picker searches on demand; server-load only the current choice so its
// title is visible on a shared URL before the picker is opened.
const optionOf = (link: { id: string; key: string; title: string }) => ({
  value: link.id,
  label: link.title ? `/${link.key} · ${link.title}` : `/${link.key}`,
});

export async function linkOptions(
  workspace: string,
  active: string | undefined,
): Promise<LinkOption[]> {
  if (!active || !/^[a-f0-9]{24}$/.test(active)) return [];
  const ctx = await serviceContext(workspace);
  const link = await getLink(ctx, active);
  return link ? [optionOf(link)] : [];
}
