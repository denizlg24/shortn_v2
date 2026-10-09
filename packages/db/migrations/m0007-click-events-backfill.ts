import { createHash, createHmac } from "node:crypto";
import { ObjectId } from "mongodb";
import type { AnyBulkWriteOperation, Document } from "mongodb";
import { linkDomain, names, oid, report, str } from "./helpers";
import type { Migration, MigrationContext } from "./runner";

const ninetyDaysMs = 90 * 86_400_000;
// Live dual-writes (src "v2") already have their event; legacy-served clicks
// keep arriving until cutover, so this backfill also runs continuously.
const sourceFilter = { src: { $ne: "v2" } };

function ipHashSecret() {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("IP_HASH_SECRET (≥32 chars) is required for 0007");
  return secret;
}

function ipPrefix(ip: string) {
  if (ip.includes(".") && !ip.includes(":"))
    return `${ip.split(".").slice(0, 3).join(".")}.0/24`;
  return `${(ip.split("::")[0]?.split(":") ?? []).slice(0, 3).join(":")}::/48`;
}

function refDomain(referrer: string | undefined) {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function utm(query: unknown) {
  if (!query || typeof query !== "object") return undefined;
  const entries = ["source", "medium", "campaign", "term", "content"].flatMap(
    (field) => {
      const value = str(Reflect.get(query, `utm_${field}`));
      return value ? [[field, value] as const] : [];
    },
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

async function backfillFloor(ctx: MigrationContext) {
  const [latest] = await ctx
    .read(names.click_events)
    .find(
      { legacyId: { $exists: true } },
      { projection: { legacyId: 1 }, sort: { legacyId: -1 }, limit: 1 },
    )
    .toArray();
  const legacyId = oid(latest?.legacyId);
  // Clicks are created in request order but not strictly by _id; a margin
  // re-reads the recent tail and the runner skips events already copied.
  return legacyId
    ? ObjectId.createFromTime(
        Math.floor(legacyId.getTimestamp().getTime() / 1000) - 600,
      )
    : undefined;
}

export const clickEventsBackfill: Migration = {
  id: "0007-click-events-backfill",
  phase: "backfill",
  continuous: true,
  async up(ctx) {
    const secret = ipHashSecret();
    const floor = await backfillFloor(ctx);
    await ctx.batch({
      name: names.clicks,
      target: names.click_events,
      mode: "time-series",
      filter: { ...sourceFilter, ...(floor ? { _id: { $gte: floor } } : {}) },
      operations: async (clicks) => {
        const clickCodes = clicks.flatMap((click) =>
          click.type === "scan" ? [] : (str(click.urlCode) ?? []),
        );
        const scanCodes = clicks.flatMap((click) =>
          click.type === "scan" ? (str(click.urlCode) ?? []) : [],
        );
        const qrs = await ctx
          .read(names.qr_codes)
          .find(
            { qrCodeId: { $in: scanCodes } },
            {
              projection: { qrCodeId: 1, urlId: 1, linkId: 1, workspaceId: 1 },
            },
          )
          .toArray();
        const qrByCode = new Map(qrs.map((qr) => [str(qr.qrCodeId), qr]));
        const links = await ctx
          .read(names.links)
          .find(
            {
              urlCode: {
                $in: [
                  ...clickCodes,
                  ...qrs.flatMap((qr) => str(qr.urlId) ?? []),
                ],
              },
            },
            { projection: { urlCode: 1, workspaceId: 1 }, sort: { _id: 1 } },
          )
          .toArray();
        const linkByCode = new Map<string, Document>();
        for (const link of links) {
          const code = str(link.urlCode);
          if (code && !linkByCode.has(code)) linkByCode.set(code, link);
        }
        return clicks.map((click): AnyBulkWriteOperation<Document> => {
          const code = str(click.urlCode) ?? "";
          const scan = click.type === "scan";
          const qr = scan ? qrByCode.get(code) : undefined;
          const link = scan
            ? linkByCode.get(str(qr?.urlId) ?? "")
            : linkByCode.get(code);
          const linkId = oid(qr?.linkId) ?? oid(link?._id) ?? null;
          const ip = str(click.ip);
          const ua = str(click.userAgent) ?? "";
          const referrer = str(click.referrer);
          const referrerDomain = refDomain(referrer);
          const campaign = utm(click.queryParams);
          const ts =
            click.timestamp instanceof Date
              ? click.timestamp
              : (oid(click._id)?.getTimestamp() ?? new Date(0));
          const optional = {
            country: str(click.country),
            region: str(click.region),
            city: str(click.city),
            tz: str(click.timezone),
            lang: str(click.language),
            browser: str(click.browser),
            os: str(click.os),
            device: str(click.deviceType),
            referrer,
            refDomain: referrerDomain,
          };
          return {
            insertOne: {
              document: {
                ts,
                m: {
                  workspaceId:
                    oid(link?.workspaceId) ?? oid(qr?.workspaceId) ?? null,
                  linkId,
                  ...(qr ? { qrId: qr._id } : {}),
                  kind: scan ? "scan" : "click",
                  domain: linkDomain,
                  key: scan ? (str(qr?.urlId) ?? code) : code,
                  legacyCode: code,
                },
                ...Object.fromEntries(
                  Object.entries(optional).filter(([, value]) => value),
                ),
                bot: false,
                ...(campaign ? { utm: campaign } : {}),
                ipHash: ip
                  ? createHmac("sha256", secret).update(ip).digest("hex")
                  : "",
                ipPrefix: ip ? ipPrefix(ip) : "",
                uaHash: createHash("sha256")
                  .update(ua)
                  .digest("hex")
                  .slice(0, 32),
                legacyId: click._id,
              },
            },
          };
        });
      },
    });
    // Raw IPs are kept 90 days for abuse handling only (04 §Retention).
    await ctx.batch({
      name: names.clicks,
      target: names.click_ips,
      checkpointId: "clicks__click_ips",
      filter: {
        ...sourceFilter,
        ip: { $type: "string", $ne: "" },
        timestamp: { $gte: new Date(Date.now() - ninetyDaysMs) },
      },
      operations: (clicks) =>
        clicks.map((click) => ({
          updateOne: {
            filter: { legacyId: click._id },
            update: {
              $setOnInsert: {
                legacyId: click._id,
                ip: click.ip,
                ts: click.timestamp,
              },
            },
            upsert: true,
          },
        })),
    });
    // Historic counters drifted ~9× above recorded events (audit); keep them.
    for (const collection of [names.links, names.qr_codes])
      await ctx.batch({
        name: collection,
        filter: { "stats.legacyTotal": { $exists: false } },
        operations: (docs) =>
          docs.map((doc) => ({
            updateOne: {
              filter: { _id: doc._id, "stats.legacyTotal": { $exists: false } },
              update: {
                $set: {
                  "stats.legacyTotal":
                    typeof doc.clicks?.total === "number" &&
                    doc.clicks.total >= 0
                      ? doc.clicks.total
                      : 0,
                },
              },
            },
          })),
      });
  },
  async verify(ctx) {
    // Clicks written in the last two minutes may postdate this run's read.
    const settled = ObjectId.createFromTime(
      Math.floor(Date.now() / 1000) - 120,
    );
    // Set-based, not count-based (02 M7): walk both id-ordered index scans
    // together. A $lookup into the time-series collection can't use its
    // legacyId index and costs minutes on every continuous run.
    const sourceIds = ctx
      .read(names.clicks)
      .find(
        { ...sourceFilter, _id: { $lt: settled } },
        { projection: { _id: 1 }, sort: { _id: 1 }, allowDiskUse: true },
      );
    const copiedIds = ctx.read(names.click_events).find(
      { legacyId: { $exists: true } },
      {
        projection: { _id: 0, legacyId: 1 },
        sort: { legacyId: 1 },
        allowDiskUse: true,
      },
    );
    let sources = 0;
    let events = 0;
    let missing = 0;
    const missingSamples: string[] = [];
    let copied = await copiedIds.next();
    for await (const click of sourceIds) {
      sources++;
      const id = String(click._id);
      while (copied && String(copied.legacyId) < id) {
        events++;
        copied = await copiedIds.next();
      }
      if (copied && String(copied.legacyId) === id) {
        while (copied && String(copied.legacyId) === id) {
          events++;
          copied = await copiedIds.next();
        }
      } else {
        missing++;
        if (missingSamples.length < 20) missingSamples.push(id);
      }
    }
    while (copied) {
      events++;
      copied = await copiedIds.next();
    }
    const withoutTotal = await ctx
      .read(names.links)
      .countDocuments({ "stats.legacyTotal": { $exists: false } });
    const orphans = await ctx
      .read(names.click_events)
      .countDocuments({ legacyId: { $exists: true }, "m.linkId": null });
    const discrepancies = [
      ...(missing
        ? [
            `${missing} legacy clicks have no click_events copy (e.g. ${missingSamples.join(", ")})`,
          ]
        : []),
      ...(withoutTotal
        ? [`${withoutTotal} links without stats.legacyTotal`]
        : []),
    ];
    return report(
      {
        sources,
        events,
        missing,
        orphans,
        linksWithoutLegacyTotal: withoutTotal,
      },
      discrepancies,
    );
  },
};
