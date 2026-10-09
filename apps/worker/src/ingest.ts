import { decodeClickMessage, enrich, utcDay } from "@shortn/core";
import type { ClickMessage } from "@shortn/core";
import { collection, physicalNames } from "@shortn/db";
import type { Documents } from "@shortn/db";
import { keys } from "@shortn/redis";
import type { Redis } from "ioredis";
import { ObjectId } from "mongodb";
import type { AnyBulkWriteOperation, Db, Document } from "mongodb";

export const ingestGroup = "ingest";

export type StreamEntry = [id: string, fields: string[]];

export type StreamClient = Pick<
  Redis,
  "xgroup" | "xreadgroup" | "xautoclaim" | "xack" | "hincrby" | "expire"
>;

interface LinkDoc {
  _id: ObjectId;
  sub?: string;
  urlCode?: string;
  workspaceId?: ObjectId;
}
interface QrDoc {
  _id: ObjectId;
  sub?: string;
  qrCodeId?: string;
}

export interface Decoded {
  sid: string;
  message: ClickMessage;
}

const isoDay = (ts: number) => utcDay(new Date(ts)).toISOString().slice(0, 10);

export async function ensureGroup(stream: StreamClient) {
  try {
    await stream.xgroup(
      "CREATE",
      keys.clicksStream,
      ingestGroup,
      "0",
      "MKSTREAM",
    );
  } catch (error) {
    if (!String(error).includes("BUSYGROUP")) throw error;
  }
}

// Writes one batch: click_events, the legacy `clicks` dual-write with its
// counters (so the legacy dashboard keeps moving, 02 M7), and the 90-day raw
// IP log. Redelivered entries are checked against stored stream ids first.
export async function writeBatch(
  db: Db,
  decoded: Decoded[],
  options: { redelivered: boolean; ipSecret: string },
) {
  if (!decoded.length) return { inserted: 0, skipped: 0 };
  const events = collection(db, "click_events");
  const legacyClicks = db.collection(physicalNames.clicks);
  let storedEvents = new Set<string>();
  let storedLegacy = new Set<string>();
  if (options.redelivered) {
    const sids = decoded.map((entry) => entry.sid);
    const [eventSids, legacySids] = await Promise.all([
      events.distinct("sid", { sid: { $in: sids } }),
      legacyClicks.distinct("sid", { sid: { $in: sids } }),
    ]);
    storedEvents = new Set(
      eventSids.filter((sid): sid is string => typeof sid === "string"),
    );
    storedLegacy = new Set(legacySids);
  }
  const pending = decoded.filter(
    (entry) => !storedEvents.has(entry.sid) || !storedLegacy.has(entry.sid),
  );
  if (!pending.length) return { inserted: 0, skipped: decoded.length };

  const linkIds = [...new Set(pending.map((entry) => entry.message.linkId))];
  const qrIds = [
    ...new Set(pending.flatMap((entry) => entry.message.qrId ?? [])),
  ];
  const [links, qrs] = await Promise.all([
    db
      .collection<LinkDoc>(physicalNames.links)
      .find(
        { _id: { $in: linkIds.map((id) => new ObjectId(id)) } },
        { projection: { sub: 1, urlCode: 1, workspaceId: 1 } },
      )
      .toArray(),
    db
      .collection<QrDoc>(physicalNames.qr_codes)
      .find(
        { _id: { $in: qrIds.map((id) => new ObjectId(id)) } },
        { projection: { sub: 1, qrCodeId: 1 } },
      )
      .toArray(),
  ]);
  const linkById = new Map(links.map((link) => [link._id.toHexString(), link]));
  const qrById = new Map(qrs.map((qr) => [qr._id.toHexString(), qr]));
  const subs = [
    ...new Set(
      links.flatMap((link) =>
        !link.workspaceId && link.sub ? [link.sub] : [],
      ),
    ),
  ];
  const workspaces = subs.length
    ? await db
        .collection<{ _id: ObjectId; legacySub?: string }>(
          physicalNames.workspaces,
        )
        .find(
          { legacySub: { $in: subs }, personal: true },
          { projection: { legacySub: 1 } },
        )
        .toArray()
    : [];
  const workspaceBySub = new Map(
    workspaces.flatMap((ws) =>
      ws.legacySub ? [[ws.legacySub, ws._id] as const] : [],
    ),
  );

  const eventDocs: Documents["click_events"][] = [];
  const legacyDocs: Document[] = [];
  const ipOps: AnyBulkWriteOperation<Document>[] = [];
  const linkCounters: AnyBulkWriteOperation<Document>[] = [];
  const qrCounters: AnyBulkWriteOperation<Document>[] = [];
  for (const { sid, message } of pending) {
    const link = linkById.get(message.linkId);
    const qr = message.qrId ? qrById.get(message.qrId) : undefined;
    const ts = new Date(message.ts);
    const enriched = enrich(message, options.ipSecret);
    const workspaceId =
      link?.workspaceId ??
      (link?.sub ? workspaceBySub.get(link.sub) : undefined);
    if (!storedEvents.has(sid))
      eventDocs.push({
        ts,
        m: {
          workspaceId: workspaceId ?? null,
          linkId: new ObjectId(message.linkId),
          ...(message.qrId ? { qrId: new ObjectId(message.qrId) } : {}),
          kind: message.qrId ? "scan" : "click",
          domain: message.domain,
          key: message.key,
          ...(link?.urlCode ? { legacyCode: link.urlCode } : {}),
        },
        sid,
        bot: false,
        ...(message.country ? { country: message.country } : {}),
        ...(message.regionCode ? { region: message.regionCode } : {}),
        ...(message.city ? { city: message.city } : {}),
        ...(message.continent ? { continent: message.continent } : {}),
        ...(message.tz ? { tz: message.tz } : {}),
        ...(message.lang ? { lang: message.lang } : {}),
        ...(enriched.browser ? { browser: enriched.browser } : {}),
        ...(enriched.os ? { os: enriched.os } : {}),
        device: enriched.device,
        ...(message.referrer ? { referrer: message.referrer } : {}),
        ...(enriched.refDomain ? { refDomain: enriched.refDomain } : {}),
        ...(enriched.utm ? { utm: enriched.utm } : {}),
        ipHash: enriched.ipHash,
        ipPrefix: enriched.ipPrefix,
        uaHash: enriched.uaHash,
      });
    if (message.ip)
      ipOps.push({
        updateOne: {
          filter: { sid },
          update: { $setOnInsert: { sid, ip: message.ip, ts } },
          upsert: true,
        },
      });
    // Legacy records nothing once the link (or the QR it counts for) is gone.
    if (!link || (message.qrId && !qr) || storedLegacy.has(sid)) continue;
    legacyDocs.push({
      sub: qr ? qr.sub : link.sub,
      urlCode: qr ? qr.qrCodeId : link.urlCode,
      type: qr ? "scan" : "click",
      timestamp: ts,
      ip: message.ip ?? "",
      country: message.country,
      region: message.regionCode,
      city: message.city,
      timezone: message.tz ?? "",
      language: message.lang ?? "",
      referrer: message.referrer ?? "",
      pathname: `/${message.key}`,
      queryParams: message.query ?? {},
      userAgent: message.ua ?? "",
      browser: enriched.browser,
      os: enriched.os,
      deviceType: enriched.device,
      src: "v2",
      sid,
    });
    const counter = {
      updateOne: {
        filter: { _id: qr ? qr._id : link._id },
        update: {
          $inc: { "clicks.total": 1 },
          $max: { "clicks.lastClick": ts },
        },
      },
    };
    (qr ? qrCounters : linkCounters).push(counter);
  }

  if (eventDocs.length) await events.insertMany(eventDocs, { ordered: false });
  if (legacyDocs.length)
    await legacyClicks.insertMany(legacyDocs, { ordered: false });
  await Promise.all([
    ipOps.length &&
      db
        .collection(physicalNames.click_ips)
        .bulkWrite(ipOps, { ordered: false }),
    linkCounters.length &&
      db
        .collection(physicalNames.links)
        .bulkWrite(linkCounters, { ordered: false }),
    qrCounters.length &&
      db
        .collection(physicalNames.qr_codes)
        .bulkWrite(qrCounters, { ordered: false }),
  ]);
  return {
    inserted: eventDocs.length,
    skipped: decoded.length - eventDocs.length,
  };
}

export function decodeEntries(entries: StreamEntry[]) {
  const decoded: Decoded[] = [];
  const rejected: { sid: string; reason: string; fields: string[] }[] = [];
  for (const [sid, fields] of entries) {
    try {
      decoded.push({ sid, message: decodeClickMessage(fields) });
    } catch (error) {
      rejected.push({ sid, reason: String(error).slice(0, 500), fields });
    }
  }
  return { decoded, rejected };
}

export function createIngest(options: {
  stream: StreamClient;
  db: Db;
  ipSecret: string;
  consumer: string;
  batchSize?: number;
  blockMs?: number;
  log?: (message: string, error?: unknown) => void;
}) {
  const { stream, db, consumer } = options;
  const batchSize = options.batchSize ?? 500;
  const log = options.log ?? console.error;
  let lastLoopAt = Date.now();
  let stopping = false;
  const stats = { processed: 0, bots: 0, rejected: 0, skipped: 0 };

  const handle = async (entries: StreamEntry[], redelivered: boolean) => {
    if (!entries.length) return;
    const { decoded, rejected } = decodeEntries(entries);
    if (rejected.length) {
      await db
        .collection(physicalNames.click_rejects)
        .insertMany(rejected.map((item) => ({ ...item, at: new Date() })));
      stats.rejected += rejected.length;
    }
    const bots = decoded.filter((entry) => entry.message.bot);
    const humans = decoded.filter((entry) => !entry.message.bot);
    // Bot hits stay out of analytics; only their volume per link is kept.
    for (const { message } of bots) {
      const key = `bots:${isoDay(message.ts)}`;
      await stream.hincrby(key, message.linkId, 1);
      await stream.expire(key, 400 * 86_400);
    }
    const result = await writeBatch(db, humans, {
      redelivered,
      ipSecret: options.ipSecret,
    });
    await stream.xack(
      keys.clicksStream,
      ingestGroup,
      ...entries.map(([id]) => id),
    );
    stats.processed += result.inserted;
    stats.skipped += result.skipped;
    stats.bots += bots.length;
  };

  const read = async (id: string): Promise<StreamEntry[]> => {
    const reply =
      id === ">"
        ? await stream.xreadgroup(
            "GROUP",
            ingestGroup,
            consumer,
            "COUNT",
            batchSize,
            "BLOCK",
            options.blockMs ?? 1000,
            "STREAMS",
            keys.clicksStream,
            id,
          )
        : await stream.xreadgroup(
            "GROUP",
            ingestGroup,
            consumer,
            "COUNT",
            batchSize,
            "STREAMS",
            keys.clicksStream,
            id,
          );
    return parseReadReply(reply);
  };

  const claimStale = async () => {
    const reply = await stream.xautoclaim(
      keys.clicksStream,
      ingestGroup,
      consumer,
      60_000,
      "0-0",
      "COUNT",
      batchSize,
    );
    const entries = Array.isArray(reply) ? parseEntries(reply[1]) : [];
    await handle(entries, true);
  };

  return {
    stats,
    get lastLoopAt() {
      return lastLoopAt;
    },
    async run() {
      await ensureGroup(stream);
      let recoverOwn = true;
      let lastClaim = 0;
      while (!stopping) {
        lastLoopAt = Date.now();
        try {
          // Entries this consumer read but never acknowledged (crash or a
          // failed batch) are retried before new ones.
          while (recoverOwn) {
            const own = await read("0");
            if (!own.length) recoverOwn = false;
            else await handle(own, true);
          }
          if (Date.now() - lastClaim > 30_000) {
            lastClaim = Date.now();
            await claimStale();
          }
          await handle(await read(">"), false);
        } catch (error) {
          recoverOwn = true;
          log("ingest batch failed; entries stay pending for retry", error);
          await Bun.sleep(2000);
        }
      }
    },
    stop() {
      stopping = true;
    },
    handle,
  };
}

function parseEntries(value: unknown): StreamEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: StreamEntry[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry)) continue;
    const [id, fields] = entry;
    if (typeof id !== "string" || !Array.isArray(fields)) continue;
    entries.push([
      id,
      fields.filter((field): field is string => typeof field === "string"),
    ]);
  }
  return entries;
}

function parseReadReply(reply: unknown): StreamEntry[] {
  if (!Array.isArray(reply)) return [];
  return reply.flatMap((stream) =>
    Array.isArray(stream) ? parseEntries(stream[1]) : [],
  );
}
