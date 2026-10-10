// Recomputes click_rollups and links.stats from click_events for every day
// that has events. Run once after 0007's first backfill; the worker keeps the
// last two days current afterwards.
//   MONGODB_URL=… MONGODB_DB=… bun scripts/rebuild-rollups.ts
import { recomputeRollups } from "@shortn/core";
import { collection } from "@shortn/db";
import { MongoClient } from "mongodb";

const url = process.env.MONGODB_URL;
const database = process.env.MONGODB_DB;
if (!url || !database) throw new Error("Set MONGODB_URL and MONGODB_DB");
const client = await new MongoClient(url).connect();
try {
  const db = client.db(database);
  const [first] = await collection(db, "click_events")
    .find({}, { projection: { ts: 1 }, sort: { ts: 1 }, limit: 1 })
    .toArray();
  if (!first) console.log("no click events");
  else {
    const links = await recomputeRollups(db, first.ts, new Date());
    const rollups = await collection(db, "click_rollups").countDocuments();
    console.log(JSON.stringify({ from: first.ts, links, rollups }));
  }
} finally {
  await client.close();
}
