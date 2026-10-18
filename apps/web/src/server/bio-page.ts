import "server-only";
import { bioCanonical } from "@shortn/core/bio-hosts";
import { getBioPage } from "@shortn/core";
import { notFound } from "next/navigation";
import { cache } from "react";
import { serviceContext } from "./context";
import { env } from "./env";

// One lookup per request for the bio pages and their metadata.
export const loadBio = cache(async (workspace: string, id: string) => {
  const ctx = await serviceContext(workspace);
  const bio = await getBioPage(ctx, id);
  if (!bio) notFound();
  return { ctx, bio };
});

// Legacy serves /b/{slug} on the root site until P5.
export const bioPublicUrl = (slug: string) =>
  env().BIO_DELIVERY_ENABLED === "1"
    ? bioCanonical(slug, env().PUBLIC_ORIGIN, env().BIO_SUBDOMAINS === "1")
    : `${env().PUBLIC_ORIGIN}/b/${slug}`;

export type BioTab =
  | "overview"
  | "profile"
  | "links"
  | "socials"
  | "appearance"
  | "editor"
  | "analytics";

// Viewers get the overview only: every other tab is a form.
export const bioTabs = (
  workspace: string,
  id: string,
  editable: boolean,
  label: (key: BioTab) => string,
) => {
  const base = `/${workspace}/bio/${id}`;
  const forms =
    env().BIO_DELIVERY_ENABLED === "1"
      ? (["editor"] as const)
      : (["profile", "links", "socials", "appearance"] as const);
  return [
    { label: label("overview"), href: base },
    ...(env().BIO_DELIVERY_ENABLED === "1"
      ? [{ label: label("analytics"), href: `${base}/analytics` }]
      : []),
    ...(editable
      ? forms.map((tab) => ({ label: label(tab), href: `${base}/${tab}` }))
      : []),
  ];
};
