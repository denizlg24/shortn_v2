import "server-only";
import { physicalNames } from "@shortn/db";
import {
  activeDomain,
  publicBioFromDocument,
  resolveBioDocument,
} from "@shortn/core";
import { unstable_cache } from "next/cache";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { env } from "./env";

export const loadPublicBio = cache(async (handle: string) => {
  const e = env();
  if (e.BIO_DELIVERY_ENABLED !== "1") notFound();
  const database = await db();
  const page = await resolveBioDocument(database, handle);
  if (!page) notFound();
  // Handle/alias identity is checked live, independently of cached content.
  const bio = await unstable_cache(
    async () =>
      publicBioFromDocument(
        database,
        page,
        e.PUBLIC_ORIGIN,
        e.BIO_SUBDOMAINS === "1",
      ),
    [
      "public-bio-v1",
      String(page._id),
      String(page.updatedAt),
      String(page.publishedRevision ?? 0),
      e.PUBLIC_ORIGIN,
      e.BIO_SUBDOMAINS,
    ],
    { tags: [`bio:${page._id}`], revalidate: 60 },
  )();
  for (const block of bio.content.blocks) {
    if (block.type === "qr" && bio.links[block.linkId])
      bio.links[block.linkId]!.qrImage = new URL(
        `/_bio/${bio.handle}/qr/${encodeURIComponent(block.id)}`,
        e.PUBLIC_ORIGIN,
      ).href;
  }
  if (handle !== bio.handle) permanentRedirect(bio.canonical);
  return { ...bio, renderedAt: Date.now() };
});
export const loadDomainBio = cache(async (hostname: string) => {
  const domain = await activeDomain(await db(), hostname);
  if (
    !domain ||
    !["bio", "both"].includes(String(domain.kind)) ||
    !domain.bioPageId
  )
    notFound();
  const page = await (
    await db()
  )
    .collection(physicalNames.bio_pages)
    .findOne({
      _id: domain.bioPageId,
      workspaceId: domain.workspaceId,
      published: true,
    });
  if (!page) notFound();
  return loadPublicBio(String(page.handle));
});
