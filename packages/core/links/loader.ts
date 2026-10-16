import type { Db } from "mongodb";
import { physicalNames } from "@shortn/db";
import {
  linkProjection,
  toCachedLink,
  isLegacyQrBacked,
  type CachedLink,
  type LegacyLinkFields,
  type LegacyQrFields,
} from "./cached-link";
export type LinkLoader = (domain: string, key: string) => Promise<CachedLink>;

// Legacy fields are authoritative during coexistence: urlCode first (legacy's
// own lookup), then the derived {domain,key}, then renamed-key aliases.
export function mongoLinkLoader(
  db: Db,
  rootDomain = "shortn.at",
  onLoad?: () => void,
): LinkLoader {
  const links = db.collection<LegacyLinkFields>(physicalNames.links);
  const qrCodes = db.collection<LegacyQrFields>(physicalNames.qr_codes);
  return async (domain, key) => {
    onLoad?.();
    const link =
      (domain === rootDomain
        ? await links.findOne(
            {
              urlCode: key,
              $or: [{ domain: rootDomain }, { domain: { $exists: false } }],
            },
            { projection: linkProjection },
          )
        : null) ??
      (await links.findOne({ domain, key }, { projection: linkProjection }));
    if (link) {
      const qr = isLegacyQrBacked(link)
        ? await qrCodes.findOne(
            {
              $or: [
                { linkId: link._id },
                {
                  linkId: { $exists: false },
                  urlId: link.urlCode ?? key,
                  qrCodeId: link.qrCodeId,
                },
              ],
              ...(link.workspaceId
                ? {
                    $and: [
                      {
                        $or: [
                          { workspaceId: link.workspaceId },
                          { workspaceId: { $exists: false } },
                        ],
                      },
                    ],
                  }
                : {}),
            },
            { projection: { _id: 1, qrCodeId: 1, "clicks.total": 1 } },
          )
        : null;
      return toCachedLink(link, key, qr);
    }
    const alias = await links.findOne(
      { domain, previousKeys: key },
      { projection: { _id: 1, urlCode: 1, key: 1, deletedAt: 1 } },
    );
    if (alias?.deletedAt) return { kind: "deleted" };
    const canonical = alias?.urlCode ?? alias?.key;
    if (alias && canonical)
      return { kind: "alias", id: alias._id.toHexString(), key: canonical };
    return { kind: "missing" };
  };
}
