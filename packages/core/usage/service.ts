import type { Entitlements, Period } from "@shortn/billing";
import { collection, type Documents } from "@shortn/db";
import type { Db } from "mongodb";
import type { Workspace } from "../workspaces/service";
import { ownedBy } from "../workspaces/service";

export type UsageMetric = "links" | "qrCodes" | "bioPages";

// Counts come from the documents themselves, so links created in legacy
// during coexistence are included (06: counters are a cache, not a ledger).
export async function countUsage(
  db: Db,
  workspace: Workspace,
  period: Period,
): Promise<Record<UsageMetric, number>> {
  const created = { date: { $gte: period.start, $lt: period.end } };
  const [links, qrCodes, bioPages] = await Promise.all([
    collection(db, "links").countDocuments({
      $and: [
        ownedBy<Documents["links"]>(workspace),
        created,
        { isQrCode: { $ne: true } },
      ],
    }),
    collection(db, "qr_codes").countDocuments({
      $and: [ownedBy<Documents["qr_codes"]>(workspace), created],
    }),
    collection(db, "bio_pages").countDocuments(
      ownedBy<Documents["bio_pages"]>(workspace, "userId"),
    ),
  ]);
  return { links, qrCodes, bioPages };
}

export function limitFor(entitlements: Entitlements, metric: UsageMetric) {
  return entitlements.limits[metric];
}
