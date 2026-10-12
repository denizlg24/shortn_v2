import { bioOutboxCollection } from "@shortn/core";
import { bioContentSchema } from "@shortn/core/bio-content";
import { bioCanonical } from "@shortn/core/bio-hosts";
import { physicalNames } from "@shortn/db";
import type { Db } from "mongodb";
export async function deliverBioInvalidations(
  db: Db,
  config: {
    webOrigin: string;
    secret: string;
    rootOrigin: string;
    subdomains: boolean;
    zoneId?: string | undefined;
    token?: string | undefined;
  },
  request: typeof fetch = fetch,
  now = new Date(),
) {
  const jobs = db.collection(bioOutboxCollection);
  for (const job of await jobs
    .find({ nextAttemptAt: { $lte: now } })
    .limit(30)
    .toArray()) {
    const page = await db
      .collection(physicalNames.bio_pages)
      .findOne({ _id: job.bioPageId });
    if (!page) {
      await jobs.deleteOne({ _id: job._id });
      continue;
    }
    try {
      const invalidated = await request(
        new URL("/api/internal/bio/revalidate", config.webOrigin),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: String(page._id) }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!invalidated.ok)
        throw new Error(`Origin invalidation failed (${invalidated.status})`);
      if (config.zoneId && config.token) {
        const files = new Set([
          bioCanonical(
            String(page.handle),
            config.rootOrigin,
            config.subdomains,
          ),
          new URL(`/_bio/${page.handle}`, config.rootOrigin).href,
          new URL(`/b/${page.legacySlug ?? page.slug}`, config.rootOrigin).href,
          new URL(`/_bio/${page.handle}/opengraph-image`, config.rootOrigin)
            .href,
        ]);
        if (job.oldDomain) files.add(`https://${job.oldDomain}/`);
        if (page.customDomain) files.add(`https://${page.customDomain}/`);
        if (job.oldHandle)
          files.add(
            bioCanonical(
              String(job.oldHandle),
              config.rootOrigin,
              config.subdomains,
            ),
          );
        const purge = await request(
          `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(config.zoneId)}/purge_cache`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ files: [...files] }),
            signal: AbortSignal.timeout(15000),
          },
        );
        const result = (await purge.json()) as { success: boolean };
        if (!purge.ok || !result.success)
          throw new Error(`Edge invalidation failed (${purge.status})`);
      }
      const content = bioContentSchema.safeParse(page.publishedContent);
      const boundaries = content.success
        ? content.data.blocks
            .flatMap((b) => [b, ...(b.type === "links" ? b.items : [])])
            .flatMap((b) => [b.schedule?.from, b.schedule?.to])
            .filter((v): v is string => Boolean(v))
            .map((v) => new Date(v))
            .filter((v) => v > now)
            .sort((a, b) => a.getTime() - b.getTime())
        : [];
      if (boundaries[0])
        await jobs.updateOne(
          { _id: job._id, updatedAt: job.updatedAt },
          { $set: { attempts: 0, nextAttemptAt: boundaries[0] } },
        );
      else await jobs.deleteOne({ _id: job._id, updatedAt: job.updatedAt });
    } catch (error) {
      await jobs.updateOne(
        { _id: job._id, updatedAt: job.updatedAt },
        {
          $set: {
            lastError:
              error instanceof Error ? error.message : "invalidation_failed",
            nextAttemptAt: new Date(
              now.getTime() +
                Math.min(
                  3600000,
                  5000 * 2 ** Math.min(Number(job.attempts ?? 0), 10),
                ),
            ),
          },
          $inc: { attempts: 1 },
        },
      );
    }
  }
}
