import "server-only";
import { getTagItem, tagUsage } from "@shortn/core";
import { notFound } from "next/navigation";
import { cache } from "react";
import { serviceContext } from "./context";

// One lookup per request for a tag's pages and their metadata.
export const loadTag = cache(async (workspace: string, id: string) => {
  const ctx = await serviceContext(workspace);
  const [tag, usage] = await Promise.all([
    getTagItem(ctx, id),
    tagUsage(ctx, id),
  ]);
  if (!tag || !usage) notFound();
  return { ctx, tag, usage };
});

export const tagLinksHref = (workspace: string, name: string) =>
  `/${workspace}/links?${new URLSearchParams({ tag: name })}`;
