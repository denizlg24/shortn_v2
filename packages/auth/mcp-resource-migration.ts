import { physicalNames } from "@shortn/db";
import type { Db } from "mongodb";

/** Preserve pre-1.7 MCP registrations when per-client resource links become required. */
export async function backfillMcpResourceLinks(
  db: Db,
  resource: string,
  apply = false,
) {
  const configured = await db
    .collection(physicalNames.oauth_resources)
    .findOne({ identifier: resource, disabled: { $ne: true } });
  if (!configured)
    throw new Error(
      "Initialize the patched auth provider with this MCP resource before migrating registrations",
    );
  const clients = db
    .collection(physicalNames.oauth_clients)
    .find({ clientId: { $type: "string" } }, { projection: { clientId: 1 } })
    .batchSize(500);
  let examined = 0,
    missing = 0,
    linked = 0;
  let batch: string[] = [];
  const flush = async () => {
    if (!batch.length) return;
    const links = db.collection(physicalNames.oauth_client_resources);
    const existing = new Set(
      (
        await links
          .find(
            { clientId: { $in: batch }, resourceId: resource },
            { projection: { clientId: 1 } },
          )
          .toArray()
      ).map((row) => row.clientId),
    );
    const absent = batch.filter((id) => !existing.has(id));
    examined += batch.length;
    missing += absent.length;
    if (apply && absent.length) {
      const result = await links.bulkWrite(
        absent.map((clientId) => ({
          updateOne: {
            filter: { clientId, resourceId: resource },
            update: {
              $setOnInsert: {
                clientId,
                resourceId: resource,
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      linked += result.upsertedCount;
    }
    batch = [];
  };
  try {
    for await (const client of clients) {
      batch.push(client.clientId);
      if (batch.length === 500) await flush();
    }
    await flush();
    return { examined, missing, linked, applied: apply };
  } finally {
    await clients.close();
  }
}
