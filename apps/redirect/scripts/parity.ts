// P2 gate (14): resolve every link and legacy QR key through legacy and
// apps/redirect against the same database and compare status + Location.
//   MONGODB_URL=… MONGODB_DB=… bun scripts/parity.ts <legacy-origin> <redirect-origin>
import { physicalNames } from "@shortn/db";
import { MongoClient } from "mongodb";

const [legacyOrigin, redirectOrigin] = process.argv.slice(2);
const url = process.env.MONGODB_URL;
const database = process.env.MONGODB_DB;
if (!legacyOrigin || !redirectOrigin || !url || !database)
  throw new Error(
    "usage: MONGODB_URL=… MONGODB_DB=… bun scripts/parity.ts <legacy-origin> <redirect-origin>",
  );

// A bot agent: legacy records nothing for bots and the redirect only counts
// them, so the check leaves analytics untouched.
const headers = {
  "user-agent": "shortn-parity-check bot",
  "x-edge-auth": process.env.EDGE_AUTH_SECRET ?? "",
};

async function outcome(origin: string, path: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`${origin}${path}`, {
        redirect: "manual",
        headers,
      });
      await response.body?.cancel();
      return `${response.status} ${response.headers.get("location") ?? ""}`;
    } catch (error) {
      if (attempt >= 2) return `ERR ${String(error)}`;
      await Bun.sleep(500);
    }
  }
}

const client = await new MongoClient(url).connect();
try {
  const db = client.db(database);
  const codes = await db
    .collection(physicalNames.links)
    .distinct("urlCode", { urlCode: { $type: "string" } });
  const qrCodes = await db
    .collection(physicalNames.qr_codes)
    .distinct("urlId", { urlId: { $type: "string" } });
  const paths = [
    ...codes.map((code) => `/${encodeURIComponent(String(code))}`),
    ...qrCodes.map((code) => `/qr/${encodeURIComponent(String(code))}`),
    "/parity-check-missing-key-1",
    "/qr/parity-check-missing-key-2",
  ];
  const mismatches: { path: string; legacy: string; redirect: string }[] = [];
  let checked = 0;
  const queue = [...paths];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        const [legacy, redirect] = await Promise.all([
          outcome(legacyOrigin, path),
          outcome(redirectOrigin, path),
        ]);
        if (legacy !== redirect) mismatches.push({ path, legacy, redirect });
        if (++checked % 250 === 0)
          console.log(
            `${checked}/${paths.length} checked, ${mismatches.length} mismatches`,
          );
      }
    }),
  );
  console.log(
    JSON.stringify({
      checked,
      links: codes.length,
      qrPaths: qrCodes.length,
      mismatches: mismatches.length,
    }),
  );
  for (const mismatch of mismatches.slice(0, 50))
    console.log(JSON.stringify(mismatch));
  process.exitCode = mismatches.length ? 1 : 0;
} finally {
  await client.close();
}
