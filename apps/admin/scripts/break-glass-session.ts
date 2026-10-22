// Mints a one-hour admin session for an existing superadmin when apps/web is
// down and elevation can't run (doc 23 §1.8). Host access only; audited.
// Paste the printed value as the admin session cookie in a browser whose
// user agent matches --ua exactly.
//   MONGODB_URL=… MONGODB_DB=… bun scripts/break-glass-session.ts \
//     --email someone@example.com --ua "<navigator.userAgent>" --yes
import { createAdminSession, loadStaff } from "@shortn/core";
import {
  closeMongoClient,
  collection,
  confirmMongoTarget,
  getMongoClient,
} from "@shortn/db";
import { ObjectId } from "mongodb";

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const email = option("--email")?.trim().toLowerCase();
const userAgent = option("--ua");
if (!email || !userAgent) throw new Error("--email and --ua are required");
if (!args.includes("--yes")) throw new Error("This writes; pass --yes");

const url = process.env.MONGODB_URL;
const database = process.env.MONGODB_DB;
if (!url || !database) throw new Error("Set MONGODB_URL and MONGODB_DB");
confirmMongoTarget(url, database, args);
const db = (await getMongoClient({ url, database })).db(database);
try {
  const user = await collection(db, "user").findOne({ email });
  const staff = user ? await loadStaff(db, user._id.toHexString()) : null;
  if (!staff || staff.role !== "superadmin")
    throw new Error(`${email} isn't an active superadmin`);
  const now = new Date();
  const session = await createAdminSession(db, {
    userId: staff.id,
    userAgent,
    now,
  });
  const hour = new Date(now.getTime() + 60 * 60_000);
  await collection(db, "admin_sessions").updateOne(
    { _id: session.id },
    { $set: { expiresAt: hour, idleUntil: hour } },
  );
  await collection(db, "admin_audit_log").insertOne({
    _id: new ObjectId(),
    createdAt: now,
    actorId: staff.id,
    actorEmail: staff.email,
    actorRole: staff.role,
    action: "admin.session.break_glass",
    targetType: "session",
    targetId: session.id.slice(0, 16),
    status: "succeeded",
    completedAt: now,
    adminSessionId: session.id,
  });
  console.log(`Session valid until ${hour.toISOString()}:`);
  console.log(session.token);
} finally {
  await closeMongoClient();
}
