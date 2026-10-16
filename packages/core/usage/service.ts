import type { Entitlements, Period } from "@shortn/billing";
import { collection, type Documents } from "@shortn/db";
import type { Db, ClientSession } from "mongodb";
import type { Workspace } from "../workspaces/service";
import { ownedBy } from "../workspaces/service";

export type UsageMetric = "links" | "qrCodes" | "bioPages";

// Counts come from the documents themselves, so links created in legacy
// during coexistence are included (06: counters are a cache, not a ledger).
export async function countUsage(
  db: Db,
  workspace: Workspace,
  period: Period,
  session?: ClientSession,
): Promise<Record<UsageMetric, number>> {
  const created = { date: { $gte: period.start, $lt: period.end } };
  const options = session ? { session } : {};
  const queries = [
    () =>
      collection(db, "links").countDocuments(
        {
          $and: [
            ownedBy<Documents["links"]>(workspace),
            created,
            { isQrCode: { $ne: true } },
          ],
        },
        options,
      ),
    () =>
      collection(db, "qr_codes").countDocuments(
        { $and: [ownedBy<Documents["qr_codes"]>(workspace), created] },
        options,
      ),
    () =>
      collection(db, "bio_pages").countDocuments(
        ownedBy<Documents["bio_pages"]>(workspace, "userId"),
        options,
      ),
  ];
  // Mongo sessions do not support parallel operations inside a transaction.
  const [links = 0, qrCodes = 0, bioPages = 0] = session
    ? [await queries[0]!(), await queries[1]!(), await queries[2]!()]
    : await Promise.all(queries.map((query) => query()));
  return { links, qrCodes, bioPages };
}

export function limitFor(entitlements: Entitlements, metric: UsageMetric) {
  return entitlements.limits[metric];
}
