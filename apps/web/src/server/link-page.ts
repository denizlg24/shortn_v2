import "server-only";
import { getLink } from "@shortn/core";
import { notFound } from "next/navigation";
import { cache } from "react";
import { serviceContext } from "./context";

// One lookup per request for the link pages and their layout.
export const loadLink = cache(async (workspace: string, id: string) => {
  const ctx = await serviceContext(workspace);
  const link = await getLink(ctx, id);
  if (!link) notFound();
  return { ctx, link };
});

export const linkTabs = (
  workspace: string,
  id: string,
  label: (key: "overview" | "analytics" | "qr" | "utm" | "edit") => string,
) => {
  const base = `/${workspace}/links/${id}`;
  return [
    { label: label("overview"), href: base },
    { label: label("analytics"), href: `${base}/analytics` },
    { label: label("qr"), href: `${base}/qr` },
    { label: label("utm"), href: `${base}/utm`, match: "prefix" as const },
    { label: label("edit"), href: `${base}/edit` },
  ];
};
