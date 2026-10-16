import { collection, physicalNames, type Documents } from "@shortn/db";
import { ObjectId, type ClientSession, type Document } from "mongodb";
import { ownedBy } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import { toLinkView } from "../links/service";
import { toQrView } from "../qr/service";
import { toCampaignView } from "../campaigns/service";
import {
  bioContentSchema,
  migratedBioContent,
  bioLinkIds,
  type BioContent,
} from "../bio/content";
import { dimensions, type Dimension } from "../analytics/queries";
import { csvCell } from "../imports/csv";
import { exportedLink, linkCsvColumns, linkCsvRecord } from "./link-format";
import { aggregateAnalyticsColumns } from "./analytics";
import { analyticsAggregateRows } from "./analytics-aggregate";
import { authorizeWorkspaceExport } from "./workspace-jobs";
import { LinkExportError } from "./links";

const encoder = new TextEncoder();
const id = (value: unknown) =>
  value instanceof ObjectId
    ? value.toHexString()
    : typeof value === "string"
      ? value
      : "";
const date = (value: unknown) =>
  value instanceof Date ? value.toISOString() : null;
const text = (value: unknown) => (typeof value === "string" ? value : "");
type Category =
  | "links"
  | "qr_codes"
  | "bio_pages"
  | "bio_page_versions"
  | "campaigns"
  | "tags"
  | "domains";
const fields: Record<Category, string[]> = {
  links: [
    "_id",
    "domain",
    "urlCode",
    "key",
    "longUrl",
    "destination",
    "title",
    "description",
    "tags",
    "tagIds",
    "clicks",
    "stats",
    "createdAt",
    "date",
    "createdBy",
    "passwordProtected",
    "passwordHint",
    "safetyStatus",
    "safety",
    "disabled",
    "requiresInterstitial",
    "qrCodeId",
    "deletedAt",
    "utmLinks",
    "rules",
    "og",
    "isQrCode",
    "hidden",
    "importJobId",
  ],
  qr_codes: [
    "_id",
    "urlId",
    "qrCodeId",
    "publicId",
    "longUrl",
    "title",
    "tags",
    "clicks",
    "stats",
    "createdAt",
    "date",
    "createdBy",
    "design",
    "options",
    "attachedUrl",
    "domain",
    "linkId",
  ],
  bio_pages: [
    "_id",
    "slug",
    "legacySlug",
    "handle",
    "customDomain",
    "title",
    "description",
    "avatar",
    "avatarShape",
    "theme",
    "blocks",
    "links",
    "socials",
    "socialColor",
    "seo",
    "published",
    "publicationManaged",
    "draft",
    "draftRevision",
    "publishedContent",
    "publishedRevision",
    "createdAt",
    "updatedAt",
    "createdBy",
  ],
  bio_page_versions: [
    "_id",
    "bioPageId",
    "revision",
    "content",
    "createdAt",
    "createdBy",
  ],
  campaigns: [
    "_id",
    "title",
    "description",
    "utmDefaults",
    "links",
    "createdAt",
    "createdBy",
  ],
  tags: ["_id", "id", "name", "tagName", "color", "createdAt"],
  domains: ["_id", "hostname", "kind", "status", "createdAt"],
};
const columns: Record<Category, string[]> = {
  links: [...linkCsvColumns],
  qr_codes: [
    "id",
    "publicId",
    "key",
    "url",
    "title",
    "tags",
    "scans",
    "design",
    "storedDesign",
    "attachedLinkKey",
    "linkId",
    "createdAt",
  ],
  bio_pages: [
    "id",
    "handle",
    "customDomain",
    "draft",
    "draftRevision",
    "published",
    "publishedContent",
    "publishedRevision",
    "legacy",
    "createdAt",
    "updatedAt",
  ],
  bio_page_versions: [
    "id",
    "bioPageId",
    "revision",
    "content",
    "createdAt",
    "createdBy",
  ],
  campaigns: [
    "id",
    "title",
    "description",
    "utmDefaults",
    "links",
    "createdAt",
  ],
  tags: ["id", "legacyId", "name", "color", "createdAt"],
  domains: ["id", "hostname", "kind", "status", "createdAt"],
};
async function ownedIds(
  ctx: ServiceContext,
  values: string[],
  session: ClientSession,
) {
  const ids = [
    ...new Set(values.filter((value) => /^[a-f\d]{24}$/i.test(value))),
  ].map((value) => new ObjectId(value));
  if (!ids.length) return new Set<string>();
  const rows = await collection(ctx.db, "links")
    .find(
      { $and: [ownedBy(ctx.workspace), { _id: { $in: ids } }] },
      { session, projection: { _id: 1 } },
    )
    .toArray();
  return new Set(rows.map((row) => row._id.toHexString()));
}
async function content(
  ctx: ServiceContext,
  raw: unknown,
  session: ClientSession,
): Promise<BioContent | null> {
  const parsed = bioContentSchema.safeParse(raw);
  if (!parsed.success) return null;
  const allowed = await ownedIds(ctx, bioLinkIds(parsed.data), session);
  return {
    ...parsed.data,
    blocks: parsed.data.blocks.flatMap<BioContent["blocks"][number]>((block) =>
      block.type === "link"
        ? allowed.has(block.linkId)
          ? [block]
          : []
        : block.type === "links"
          ? [
              {
                ...block,
                items: block.items.filter((item) => allowed.has(item.linkId)),
              },
            ]
          : [block],
    ),
  };
}
async function record(
  ctx: ServiceContext,
  category: Category,
  doc: Document,
  session: ClientSession,
): Promise<Document> {
  if (category === "links")
    return {
      ...toLinkView(doc as Documents["links"], ctx.linkDomain),
      isQrCode: Boolean(doc.isQrCode),
      hidden: Boolean(doc.hidden),
      tagIds: (doc.tagIds ?? []).map(id),
    };
  if (category === "qr_codes")
    return {
      ...toQrView(doc as Documents["qr_codes"], ctx.linkDomain),
      linkId: id(doc.linkId) || null,
    };
  if (category === "campaigns") {
    const refs = (doc.links ?? []).map(id),
      allowed = await ownedIds(ctx, refs, session);
    return {
      ...toCampaignView(doc as Documents["campaigns"]),
      links: refs.filter((value: string) => allowed.has(value)),
    };
  }
  if (category === "bio_page_versions")
    return {
      id: id(doc._id),
      bioPageId: id(doc.bioPageId),
      revision: Number(doc.revision ?? 0),
      content: await content(ctx, doc.content, session),
      createdAt: date(doc.createdAt),
      createdBy: text(doc.createdBy) || null,
    };
  if (category === "bio_pages") {
    const refs = (doc.links ?? []).map((item: Document) => id(item.link)),
      allowed = await ownedIds(ctx, refs, session);
    // Keep complete legacy authored configuration as well as its current
    // normalized draft; migration-to-UI caps must not truncate a data archive.
    const legacy = {
      slug: text(doc.slug ?? doc.legacySlug),
      title: text(doc.title),
      description: text(doc.description),
      avatar: text(doc.avatar),
      avatarShape: text(doc.avatarShape),
      theme: doc.theme ?? {},
      socialColor: text(doc.socialColor),
      socials: (doc.socials ?? []).map((item: Document) => ({
        platform: text(item.platform),
        url: text(item.url),
      })),
      links: (doc.links ?? [])
        .filter((item: Document) => allowed.has(id(item.link)))
        .map((item: Document) => ({
          linkId: id(item.link),
          title: text(item.title),
          image: text(item.image),
        })),
    };
    return {
      id: id(doc._id),
      handle: text(doc.handle ?? doc.slug ?? doc.legacySlug),
      customDomain: text(doc.customDomain) || null,
      draft: await content(ctx, doc.draft ?? migratedBioContent(doc), session),
      draftRevision: Number(doc.draftRevision ?? 0),
      published: doc.publicationManaged ? Boolean(doc.published) : true,
      publicationManaged: Boolean(doc.publicationManaged),
      publishedContent: await content(
        ctx,
        doc.publishedContent ??
          (!doc.publicationManaged || doc.published
            ? migratedBioContent(doc)
            : undefined),
        session,
      ),
      publishedRevision: Number(doc.publishedRevision ?? 0),
      legacy,
      createdAt: date(doc.createdAt) ?? doc._id.getTimestamp().toISOString(),
      updatedAt: date(doc.updatedAt),
    };
  }
  if (category === "tags")
    return {
      id: id(doc._id),
      legacyId: text(doc.id) || null,
      name: text(doc.name ?? doc.tagName),
      color: text(doc.color) || null,
      createdAt: date(doc.createdAt) ?? doc._id.getTimestamp().toISOString(),
    };
  return {
    id: id(doc._id),
    hostname: text(doc.hostname),
    kind: text(doc.kind),
    status: text(doc.status),
    createdAt: date(doc.createdAt) ?? doc._id.getTimestamp().toISOString(),
  };
}
async function* encode(
  rows: AsyncIterable<Document>,
  format: "json" | "csv",
  keys: readonly string[],
  check: () => Promise<void>,
  onRow: () => void,
  linkCsv = false,
) {
  let first = true;
  yield encoder.encode(format === "json" ? "[" : `${keys.join(",")}\r\n`);
  for await (const row of rows) {
    const line =
      format === "json"
        ? `${first ? "" : ","}${JSON.stringify(row)}`
        : linkCsv
          ? linkCsvRecord(exportedLink(row as ReturnType<typeof toLinkView>))
          : `${keys.map((key) => csvCell(typeof row[key] === "object" && row[key] !== null ? JSON.stringify(row[key]) : String(row[key] ?? ""))).join(",")}\r\n`;
    yield encoder.encode(line);
    first = false;
    onRow();
    await check();
  }
  if (format === "json") yield encoder.encode("]");
}
export interface WorkspaceArchiveFile {
  name: string;
  chunks: AsyncIterable<Uint8Array>;
}
/** Caller consumes each file before advancing. One snapshot covers every file. */
export async function* workspaceArchiveFiles(
  ctx: ServiceContext,
  requestedAt: Date,
  signal?: AbortSignal,
  progress?: (done: number, phase: string) => Promise<void>,
): AsyncGenerator<WorkspaceArchiveFile> {
  const workspace = await authorizeWorkspaceExport(ctx);
  ctx = { ...ctx, workspace };
  const session = ctx.db.client.startSession({ snapshot: true }),
    counts: Record<string, number> = {};
  let done = 0,
    phase = "workspace",
    sinceCheck = 0;
  const authorize = async () => {
    if (signal?.aborted) throw new LinkExportError("export_cancelled");
    await authorizeWorkspaceExport(ctx);
    await progress?.(done, phase);
    sinceCheck = 0;
  };
  const check = async () => {
    if (signal?.aborted) throw new LinkExportError("export_cancelled");
    if (++sinceCheck >= 500) await authorize();
  };
  try {
    await authorize();
    const snapshot = await collection(ctx.db, "workspaces").findOne(
      { _id: workspace._id },
      { session },
    );
    if (!snapshot) throw new LinkExportError("forbidden");
    const profile = {
      id: id(snapshot._id),
      name: snapshot.name,
      slug: snapshot.slug,
      personal: snapshot.personal,
      createdAt: date(snapshot.createdAt),
    };
    yield {
      name: "workspace.json",
      chunks: (async function* () {
        yield encoder.encode(JSON.stringify(profile));
      })(),
    };
    for (const category of Object.keys(fields) as Category[]) {
      phase = category;
      await authorize();
      for (const format of ["json", "csv"] as const) {
        const rows = async function* () {
          const filter =
            category === "domains" || category === "bio_page_versions"
              ? { workspaceId: workspace._id }
              : ownedBy(workspace, category === "bio_pages" ? "userId" : "sub");
          const cursor = ctx.db
            .collection(physicalNames[category])
            .find(filter, {
              projection: Object.fromEntries(
                fields[category].map((field) => [field, 1]),
              ),
              session,
              batchSize: 500,
              signal,
            })
            .sort({ _id: 1 });
          try {
            for await (const doc of cursor)
              yield await record(ctx, category, doc, session);
          } finally {
            await cursor.close();
          }
        };
        if (format === "json") counts[category] = 0;
        yield {
          name: `${category}.${format}`,
          chunks: encode(
            rows(),
            format,
            columns[category],
            check,
            () => {
              done++;
              if (format === "json")
                counts[category] = (counts[category] ?? 0) + 1;
            },
            category === "links" && format === "csv",
          ),
        };
      }
    }
    phase = "analytics";
    await authorize();
    for (const format of ["json", "csv"] as const) {
      if (format === "json") counts.analytics = 0;
      const rows = analyticsAggregateRows(
        ctx.db,
        { "m.workspaceId": workspace._id },
        {
          timezone: "UTC",
          interval: "day",
          dimensions: Object.keys(dimensions) as Dimension[],
        },
        session,
        authorize,
        signal,
      );
      yield {
        name: `analytics.${format}`,
        chunks: encode(rows, format, aggregateAnalyticsColumns, check, () => {
          done++;
          if (format === "json") counts.analytics = (counts.analytics ?? 0) + 1;
        }),
      };
    }
    phase = "manifest";
    await authorize();
    yield {
      name: "manifest.json",
      chunks: (async function* () {
        yield encoder.encode(
          JSON.stringify({
            format: "shortn-workspace-v1",
            requestedAt: requestedAt.toISOString(),
            generatedAt: new Date().toISOString(),
            counts,
            analytics: {
              coverage: "all stored workspace events",
              interval: "day",
              timezone: "UTC",
              rawEventsIncluded: false,
            },
            notes: [
              "JSON preserves structured configuration and references. CSV is spreadsheet-safe; links CSV uses shortn-csv-v1.",
              "Includes hidden, QR-backing and trashed links. Password hashes, credentials, authentication records and raw visitor data are excluded.",
              "Images remain referenced by their stored URLs; image binaries and QR renders are not bundled.",
            ],
          }),
        );
      })(),
    };
    await authorize();
  } catch (error) {
    if (signal?.aborted) throw new LinkExportError("export_cancelled");
    throw error;
  } finally {
    await session.endSession();
  }
}
