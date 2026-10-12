import { physicalNames } from "@shortn/db";
import { bioViewMessageSchema } from "@shortn/core/bio-views";
import { ObjectId, type Db } from "mongodb";
import type { StreamEntry } from "./ingest";
export async function ingestBioViews(db: Db, entries: StreamEntry[]) {
  const clicks: StreamEntry[] = [];
  for (const [sid, fields] of entries) {
    const at = fields.indexOf("d");
    let raw: unknown;
    try {
      raw = JSON.parse(fields[at + 1] ?? "");
    } catch {
      clicks.push([sid, fields]);
      continue;
    }
    if (
      !raw ||
      typeof raw !== "object" ||
      Reflect.get(raw, "kind") !== "bio_view"
    ) {
      clicks.push([sid, fields]);
      continue;
    }
    const result = bioViewMessageSchema.safeParse(raw);
    if (!result.success) {
      clicks.push([sid, fields]);
      continue;
    }
    const view = result.data;
    await db
      .collection(physicalNames.bio_views)
      .updateOne(
        { sid },
        {
          $setOnInsert: {
            sid,
            kind: "bio_view",
            bioPageId: new ObjectId(view.pageId),
            workspaceId: new ObjectId(view.workspaceId),
            ts: new Date(view.ts),
            refDomain: view.refDomain ?? null,
            country: view.country ?? null,
          },
        },
        { upsert: true },
      );
  }
  return clicks;
}
