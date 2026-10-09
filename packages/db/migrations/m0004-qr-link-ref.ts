import type { AnyBulkWriteOperation, Document, ObjectId } from "mongodb";
import { names, oid, report, stableHash, str } from "./helpers";
import type { Migration, MigrationContext } from "./runner";

interface LinkRef {
  _id: ObjectId;
  isQrCode: boolean;
  qrCodeId: string | undefined;
}

// Duplicate codes are 0 in production (audit 2026-10-09), so the backing link
// is matched on urlCode alone; 275 legacy /qr/ codes lack the strict flags.
async function linksByCode(ctx: MigrationContext, codes: string[]) {
  const links = await ctx
    .read(names.links)
    .find(
      { urlCode: { $in: codes } },
      {
        projection: { urlCode: 1, isQrCode: 1, qrCodeId: 1 },
        sort: { _id: 1 },
      },
    )
    .toArray();
  const map = new Map<string, LinkRef>();
  for (const link of links) {
    const code = str(link.urlCode);
    const id = oid(link._id);
    if (code && id && !map.has(code))
      map.set(code, {
        _id: id,
        isQrCode: link.isQrCode === true,
        qrCodeId: str(link.qrCodeId),
      });
  }
  return map;
}

export const qrLinkRef: Migration = {
  id: "0004-qr-link-ref",
  phase: "expand",
  continuous: true,
  async up(ctx) {
    await ctx.batch({
      name: names.qr_codes,
      operations: async (docs) => {
        const codes = docs.flatMap((doc) =>
          [str(doc.urlId), str(doc.attachedUrl)].filter(
            (code): code is string => Boolean(code),
          ),
        );
        const links = await linksByCode(ctx, codes);
        return docs.flatMap((doc): AnyBulkWriteOperation<Document>[] => {
          const backing = links.get(str(doc.urlId) ?? "");
          const attached = links.get(str(doc.attachedUrl) ?? "");
          const qrHash = stableHash({
            urlId: doc.urlId,
            attachedUrl: doc.attachedUrl,
            qrCodeId: doc.qrCodeId,
            options: doc.options,
            date: doc.date,
            backing: backing?._id,
            attached: attached?._id,
          });
          if (doc._sync?.qrHash === qrHash) return [];
          const set: Document = {
            "_sync.qrHash": qrHash,
            design:
              doc.options && typeof doc.options === "object" ? doc.options : {},
            ...(str(doc.qrCodeId) ? { publicId: doc.qrCodeId } : {}),
            ...(doc.createdAt
              ? {}
              : doc.date instanceof Date
                ? { createdAt: doc.date }
                : {}),
          };
          const unset: Document = {};
          if (backing) {
            set.linkId = backing._id;
            set.backingFlags = {
              isQrCode: Boolean(backing.isQrCode),
              qrCodeId: backing.qrCodeId ?? null,
            };
          } else {
            unset.linkId = "";
            unset.backingFlags = "";
          }
          if (attached) set.attachedLinkId = attached._id;
          else unset.attachedLinkId = "";
          return [
            {
              updateOne: {
                filter: { _id: doc._id },
                update: {
                  $set: set,
                  ...(Object.keys(unset).length ? { $unset: unset } : {}),
                },
              },
            },
          ];
        });
      },
    });
  },
  async verify(ctx) {
    const qrs = ctx.read(names.qr_codes);
    const total = await qrs.countDocuments();
    if (ctx.direction === "down") {
      const remaining = await qrs.countDocuments({
        "_sync.qrHash": { $exists: true },
      });
      return report(
        { total, remaining },
        remaining ? [`${remaining} QR codes keep derived fields`] : [],
      );
    }
    const docs = await qrs
      .find(
        {},
        { projection: { urlId: 1, linkId: 1, qrCodeId: 1, publicId: 1 } },
      )
      .toArray();
    const links = await linksByCode(
      ctx,
      docs.flatMap((doc) => str(doc.urlId) ?? []),
    );
    const discrepancies: string[] = [];
    let orphans = 0;
    for (const doc of docs) {
      const backing = links.get(str(doc.urlId) ?? "");
      if (!backing) {
        orphans++;
        if (doc.linkId)
          discrepancies.push(`${String(doc._id)} points at a missing link`);
        continue;
      }
      const linkId = oid(doc.linkId);
      if (!linkId || !backing._id.equals(linkId))
        discrepancies.push(
          `${String(doc._id)} linkId does not match urlId ${String(doc.urlId)}`,
        );
      if (str(doc.qrCodeId) !== str(doc.publicId))
        discrepancies.push(`${String(doc._id)} publicId differs from qrCodeId`);
    }
    return report({ total, orphans }, discrepancies);
  },
  async down(ctx) {
    await ctx.batch({
      name: names.qr_codes,
      filter: { "_sync.qrHash": { $exists: true } },
      operations: (docs) =>
        docs.map((doc) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $unset: {
                linkId: "",
                publicId: "",
                attachedLinkId: "",
                design: "",
                backingFlags: "",
                "_sync.qrHash": "",
              },
            },
          },
        })),
    });
  },
};
