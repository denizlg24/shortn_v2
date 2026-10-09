import type { AnyBulkWriteOperation, Document } from "mongodb";
import { linkDomain, names, report, stableHash, str } from "./helpers";
import type { Migration } from "./runner";

const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

// Everything here is derived from legacy fields, which stay authoritative
// until P4 (02 §3a.1). Renames keep the old key as an alias.
export function deriveLink(doc: Document) {
  const urlCode = str(doc.urlCode);
  const conflict = doc.codeConflict && typeof doc.codeConflict === "object";
  const key = conflict ? str(doc.key) : urlCode;
  const inputs = {
    urlCode,
    longUrl: doc.longUrl,
    conflictKey: conflict ? doc.key : undefined,
    passwordProtected: doc.passwordProtected,
    passwordHash: doc.passwordHash,
    passwordHint: doc.passwordHint,
    safetyStatus: doc.safetyStatus,
    riskScore: doc.riskScore,
    flagged: doc.flagged,
    disabled: doc.disabled,
    disabledReason: doc.disabledReason,
    reportCount: doc.reportCount,
    lastScannedAt: doc.lastScannedAt,
    scanProvider: doc.scanProvider,
    requiresInterstitial: doc.requiresInterstitial,
    isQrCode: doc.isQrCode,
    date: doc.date,
  };
  const legacyHash = stableHash(inputs);
  const previousKey = str(doc.key);
  const renamed = Boolean(
    previousKey && key && previousKey !== key && !conflict,
  );
  const set: Document = {
    domain: str(doc.domain) ?? linkDomain,
    ...(key ? { key } : {}),
    ...(str(doc.longUrl) ? { destination: doc.longUrl } : {}),
    safety: {
      status: str(doc.safetyStatus) ?? "pending",
      riskScore: num(doc.riskScore, 0),
      flagged: Boolean(doc.flagged),
      disabled: Boolean(doc.disabled),
      ...(str(doc.disabledReason)
        ? { disabledReason: doc.disabledReason }
        : {}),
      reportCount: num(doc.reportCount, 0),
      ...(doc.lastScannedAt instanceof Date
        ? { lastScannedAt: doc.lastScannedAt }
        : {}),
      ...(str(doc.scanProvider) ? { provider: doc.scanProvider } : {}),
      interstitial: Boolean(doc.requiresInterstitial),
    },
    qr: { legacyBacking: Boolean(doc.isQrCode) },
    ...(doc.createdAt
      ? {}
      : doc.date instanceof Date
        ? { createdAt: doc.date }
        : {}),
    ...(doc.passwordProtected && str(doc.passwordHash)
      ? {
          password: {
            hash: doc.passwordHash,
            ...(str(doc.passwordHint) ? { hint: doc.passwordHint } : {}),
          },
        }
      : {}),
    "_sync.legacyHash": legacyHash,
    "_sync.lastWriter": "legacy",
  };
  const unset: Document = {};
  if (!set.password) unset.password = "";
  if (!str(doc.longUrl)) unset.destination = "";
  return { legacyHash, set, unset, renamed, previousKey };
}

export const linkDomainKey: Migration = {
  id: "0003-link-domain-key",
  phase: "expand",
  continuous: true,
  async up(ctx) {
    await ctx.batch({
      name: names.links,
      operations: (docs) =>
        docs.flatMap((doc): AnyBulkWriteOperation<Document>[] => {
          const derived = deriveLink(doc);
          const unchanged =
            doc._sync?.legacyHash === derived.legacyHash &&
            Array.isArray(doc.previousKeys);
          if (unchanged) return [];
          const hasAliases = Array.isArray(doc.previousKeys);
          const alias = derived.renamed ? derived.previousKey : undefined;
          const update: Document = {
            $set: {
              ...derived.set,
              ...(hasAliases ? {} : { previousKeys: alias ? [alias] : [] }),
            },
            $inc: { "_sync.rev": 1 },
          };
          if (alias && hasAliases) update.$addToSet = { previousKeys: alias };
          if (Object.keys(derived.unset).length) update.$unset = derived.unset;
          return [{ updateOne: { filter: { _id: doc._id }, update } }];
        }),
    });
  },
  async verify(ctx) {
    const links = ctx.read(names.links);
    const up = ctx.direction === "up";
    const total = await links.countDocuments();
    if (!up) {
      const remaining = await links.countDocuments({
        $or: [
          { domain: { $exists: true } },
          { destination: { $exists: true } },
        ],
      });
      return report(
        { total, remaining },
        remaining ? [`${remaining} links keep derived fields`] : [],
      );
    }
    const mismatched = await links
      .aggregate([
        {
          $match: {
            $or: [
              { domain: { $exists: false } },
              { previousKeys: { $exists: false } },
              {
                codeConflict: { $exists: false },
                urlCode: { $type: "string" },
                $expr: { $ne: ["$key", "$urlCode"] },
              },
              {
                longUrl: { $type: "string" },
                $expr: { $ne: ["$destination", "$longUrl"] },
              },
              {
                passwordProtected: true,
                passwordHash: { $type: "string" },
                $expr: { $ne: ["$password.hash", "$passwordHash"] },
              },
              {
                $expr: {
                  $ne: [{ $ifNull: ["$disabled", false] }, "$safety.disabled"],
                },
              },
            ],
          },
        },
        { $project: { urlCode: 1, key: 1 } },
        { $limit: 50 },
      ])
      .toArray();
    return report(
      { total, mismatched: mismatched.length },
      mismatched.map(
        (doc) => `${String(doc._id)} (${String(doc.urlCode)}) not derived`,
      ),
      mismatched,
    );
  },
  async down(ctx) {
    await ctx.batch({
      name: names.links,
      filter: {
        $or: [
          { domain: { $exists: true } },
          { "_sync.legacyHash": { $exists: true } },
        ],
      },
      operations: (docs) =>
        docs.map((doc) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $unset: {
                domain: "",
                // Keys assigned by 0001 stay until that migration reverts.
                ...(doc.codeConflict ? {} : { key: "" }),
                destination: "",
                previousKeys: "",
                safety: "",
                qr: "",
                password: "",
                "_sync.legacyHash": "",
              },
            },
          },
        })),
    });
  },
};
