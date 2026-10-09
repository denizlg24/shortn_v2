import { S3Client } from "bun";
import { createHash } from "node:crypto";
import type { AnyBulkWriteOperation, Document } from "mongodb";
import { z } from "zod";
import {
  assetMap,
  isPinataUrl,
  names,
  report,
  stableHash,
  str,
} from "./helpers";
import { buildBio } from "./m0008-bio-pages-v2";
import type { Migration, MigrationContext } from "./runner";

const extensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

interface Source {
  url: string;
  sub: string;
}

const storageEnv = z.object({
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
});

function storage() {
  const parsed = storageEnv.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      `0012 requires ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  const env = parsed.data;
  return {
    client: new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    }),
    origin: new URL(env.NEXT_PUBLIC_APP_URL).origin,
  };
}

const bioSources = (doc: Document): Source[] => {
  const sub = str(doc.userId);
  if (!sub) return [];
  const urls = [
    str(doc.avatarUrl),
    str(doc.theme?.header?.headerBackgroundImage),
    ...(Array.isArray(doc.links)
      ? doc.links.map((item: Document) => str(item?.image))
      : []),
  ];
  return urls
    .filter((url): url is string => isPinataUrl(url))
    .map((url) => ({ url, sub }));
};

async function collectSources(ctx: MigrationContext) {
  const sources = new Map<string, Source>();
  if (await ctx.exists(names.bio_pages))
    for (const doc of await ctx.read(names.bio_pages).find({}).toArray())
      for (const source of bioSources(doc)) sources.set(source.url, source);
  for (const user of await ctx
    .read(names.user)
    .find({}, { projection: { image: 1, sub: 1 } })
    .toArray()) {
    const url = str(user.image);
    const sub = str(user.sub);
    if (url && sub && isPinataUrl(url)) sources.set(url, { url, sub });
  }
  return [...sources.values()];
}

// Legacy serves `uploads/{sub}/…` keys at /api/assets, so migrated URLs work
// in both apps. Pinata pins stay until P7 + 30 days.
async function upload(source: Source, target: ReturnType<typeof storage>) {
  const response = await fetch(source.url);
  if (!response.ok)
    throw new Error(`${source.url} answered ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType =
    (response.headers.get("content-type") ?? "application/octet-stream").split(
      ";",
    )[0] ?? "";
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const key = `uploads/${source.sub}/${sha256}.${extensions[contentType] ?? "bin"}`;
  await target.client.write(key, bytes, { type: contentType });
  const targetUrl = `${target.origin}/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
  return {
    sourceUrl: source.url,
    key,
    targetUrl,
    sha256,
    size: bytes.length,
    contentType,
  };
}

export const assetsToStorage: Migration = {
  id: "0012-assets-to-storage",
  phase: "backfill",
  async up(ctx) {
    const sources = await collectSources(ctx);
    const done = await assetMap(ctx);
    const pending = sources.filter((source) => !done.has(source.url));
    ctx.log(`0012: ${sources.length} Pinata assets, ${pending.length} to copy`);
    if (!pending.length && !sources.length) return;
    const uploaded = new Map<string, Awaited<ReturnType<typeof upload>>>();
    if (!ctx.dryRun && pending.length) {
      const target = storage();
      for (const source of pending)
        uploaded.set(source.url, await upload(source, target));
    }
    const now = new Date();
    const record = (docs: Document[], urlsOf: (doc: Document) => string[]) =>
      docs.flatMap((doc) =>
        urlsOf(doc).flatMap((url): AnyBulkWriteOperation<Document>[] => {
          const row = uploaded.get(url);
          return row
            ? [
                {
                  updateOne: {
                    filter: { sourceUrl: url },
                    update: { $setOnInsert: { ...row, createdAt: now } },
                    upsert: true,
                  },
                },
              ]
            : [];
        }),
      );
    if (await ctx.exists(names.bio_pages)) {
      await ctx.batch({
        name: names.bio_pages,
        target: names.asset_migrations,
        checkpointId: "biopages__asset_migrations",
        operations: (docs) =>
          record(docs, (doc) => bioSources(doc).map((source) => source.url)),
      });
    }
    await ctx.batch({
      name: names.user,
      target: names.asset_migrations,
      checkpointId: "user__asset_migrations",
      operations: (docs) =>
        record(docs, (doc) =>
          isPinataUrl(str(doc.image)) ? [str(doc.image) ?? ""] : [],
        ),
    });
    if (!(await ctx.exists(names.bio_pages))) return;
    const assets = ctx.dryRun
      ? new Map([
          ...done,
          ...pending.map(
            (source) => [source.url, `(new) ${source.url}`] as const,
          ),
        ])
      : await assetMap(ctx);
    // Only the new fields change; legacy keeps reading the Pinata URLs.
    await ctx.batch({
      name: names.bio_pages,
      checkpointId: "biopages__asset_fields",
      filter: { handle: { $type: "string" } },
      operations: (docs) =>
        docs.flatMap((doc): AnyBulkWriteOperation<Document>[] => {
          if (!bioSources(doc).length) return [];
          const built = buildBio(doc, assets);
          return [
            {
              updateOne: {
                filter: { _id: doc._id },
                update: {
                  $set: {
                    blocks: built.blocks,
                    appearance: built.appearance,
                    ...(built.avatar ? { avatar: built.avatar } : {}),
                    "_sync.bioHash": stableHash({ built, slug: doc.slug }),
                  },
                },
              },
            },
          ];
        }),
    });
  },
  async verify(ctx) {
    const sources = await collectSources(ctx);
    const rows = (await ctx.exists(names.asset_migrations))
      ? await ctx.read(names.asset_migrations).find({}).toArray()
      : [];
    if (ctx.direction === "down") return report({ rows: rows.length }, []);
    const bySource = new Map(rows.map((row) => [str(row.sourceUrl), row]));
    const discrepancies: string[] = [];
    const target = rows.length ? storage() : undefined;
    for (const source of sources) {
      const row = bySource.get(source.url);
      if (!row) {
        discrepancies.push(`${source.url} not migrated`);
        continue;
      }
      if (!target) continue;
      const stored = new Uint8Array(
        await target.client.file(String(row.key)).arrayBuffer(),
      );
      if (createHash("sha256").update(stored).digest("hex") !== row.sha256)
        discrepancies.push(`${String(row.key)} checksum mismatch`);
      const served = await fetch(String(row.targetUrl), { method: "HEAD" });
      if (served.status !== 200)
        discrepancies.push(
          `${String(row.targetUrl)} answered ${served.status}`,
        );
    }
    if (await ctx.exists(names.bio_pages))
      for (const page of await ctx
        .read(names.bio_pages)
        .find({ handle: { $type: "string" } })
        .toArray()) {
        const urls = JSON.stringify([
          page.blocks,
          page.avatar,
          page.appearance,
        ]);
        if (
          bioSources(page).some(
            (source) => bySource.has(source.url) && urls.includes(source.url),
          )
        )
          discrepancies.push(
            `bio page ${String(page._id)} still uses a migrated Pinata URL in new fields`,
          );
      }
    return report(
      { sources: sources.length, migrated: rows.length },
      discrepancies,
    );
  },
  async down(ctx) {
    if (!(await ctx.exists(names.asset_migrations))) return;
    const rows = await ctx.read(names.asset_migrations).find({}).toArray();
    if (!ctx.dryRun && rows.length) {
      const target = storage();
      for (const row of rows) await target.client.delete(String(row.key));
    }
    await ctx.batch({
      name: names.asset_migrations,
      operations: (docs) =>
        docs.map((doc) => ({ deleteOne: { filter: { _id: doc._id } } })),
    });
  },
};
