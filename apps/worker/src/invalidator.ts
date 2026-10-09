import { physicalNames } from "@shortn/db";
import {
  createCache,
  invalidateLinks,
  linkInvalidateChannel,
} from "@shortn/redis";
import type { InvalidationStore } from "@shortn/redis";
import type { Redis } from "ioredis";
import { MongoServerError } from "mongodb";
import type { ChangeStreamDocument, Db, Document, ResumeToken } from "mongodb";

export const resumeTokenKey = "cs:link-invalidate:token";

export type TokenStore = Pick<Redis, "get" | "set" | "del">;

export type ScanStore = InvalidationStore & Pick<Redis, "scan">;

const historyLostCodes = new Set([260, 280, 286]);

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === "string");
  return [];
}

// The link codes a document version resolves under. For QR documents that is
// the backing link's code, because the cached link carries the QR target.
export function codesOf(collection: string, doc: Document | undefined) {
  if (!doc) return [];
  if (collection === physicalNames.qr_codes) return stringValues(doc.urlId);
  return [
    ...stringValues(doc.urlCode),
    ...stringValues(doc.key),
    ...stringValues(doc.previousKeys),
  ];
}

export type InvalidationPlan =
  { type: "keys"; keys: string[] } | { type: "flush" } | { type: "none" };

export function planInvalidation(
  change: ChangeStreamDocument,
): InvalidationPlan {
  if (!("ns" in change) || !change.ns || !("coll" in change.ns))
    return { type: "none" };
  const collection = change.ns.coll;
  if (
    collection !== physicalNames.links &&
    collection !== physicalNames.qr_codes
  )
    return { type: "none" };
  const after = "fullDocument" in change ? change.fullDocument : undefined;
  const before =
    "fullDocumentBeforeChange" in change
      ? change.fullDocumentBeforeChange
      : undefined;
  if (
    (change.operationType === "delete" ||
      change.operationType === "update" ||
      change.operationType === "replace") &&
    !before
  )
    // Without a pre-image the old codes are unknown; drop everything.
    return { type: "flush" };
  if (!["insert", "update", "replace", "delete"].includes(change.operationType))
    return { type: "flush" };
  const keys = [
    ...new Set([...codesOf(collection, before), ...codesOf(collection, after)]),
  ];
  return keys.length ? { type: "keys", keys } : { type: "none" };
}

export async function flushLinkCache(store: ScanStore) {
  const cache = createCache(store, String);
  let cursor = "0";
  do {
    const [next, found] = await store.scan(
      cursor,
      "MATCH",
      "link:*",
      "COUNT",
      500,
    );
    cursor = next;
    await Promise.all(found.map((key) => cache.invalidate(key)));
  } while (cursor !== "0");
  await store.publish(linkInvalidateChannel, "flush");
}

// Safety net behind legacy's explicit invalidation calls (03 §Cache coherence).
export function createInvalidator(options: {
  db: Db;
  cache: ScanStore;
  tokens: TokenStore;
  domain: string;
  log?: (message: string, error?: unknown) => void;
}) {
  const log = options.log ?? console.error;
  let stopping = false;
  let current: { close(): Promise<void> } | undefined;
  let lastEventAt = Date.now();

  const apply = async (plan: InvalidationPlan) => {
    if (plan.type === "keys")
      await invalidateLinks(options.cache, options.domain, plan.keys);
    else if (plan.type === "flush") await flushLinkCache(options.cache);
  };

  const watchOnce = async () => {
    const saved = await options.tokens.get(resumeTokenKey);
    const resumeAfter: ResumeToken | undefined = saved
      ? JSON.parse(saved)
      : undefined;
    if (!resumeAfter) await flushLinkCache(options.cache);
    const stream = options.db.watch(
      [
        {
          $match: {
            "ns.coll": { $in: [physicalNames.links, physicalNames.qr_codes] },
          },
        },
      ],
      {
        fullDocument: "updateLookup",
        fullDocumentBeforeChange: "whenAvailable",
        ...(resumeAfter ? { resumeAfter } : {}),
      },
    );
    current = stream;
    for await (const change of stream) {
      lastEventAt = Date.now();
      await apply(planInvalidation(change));
      await options.tokens.set(resumeTokenKey, JSON.stringify(change._id));
      if (stopping) break;
    }
  };

  return {
    get lastEventAt() {
      return lastEventAt;
    },
    async run() {
      while (!stopping) {
        try {
          await watchOnce();
        } catch (error) {
          if (stopping) break;
          if (
            error instanceof MongoServerError &&
            historyLostCodes.has(Number(error.code))
          ) {
            log(
              "change stream history lost; flushing link cache and resyncing",
              error,
            );
            await options.tokens.del(resumeTokenKey);
          } else log("change stream failed; resuming", error);
          await Bun.sleep(2000);
        }
      }
    },
    async stop() {
      stopping = true;
      await current?.close();
    },
  };
}
