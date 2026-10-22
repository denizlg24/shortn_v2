// Sets a user's staff role from the Forge host (doc 23 §1.8). Use it for the
// first superadmin; after that, superadmins change roles in the console.
//   MONGODB_URL=… MONGODB_DB=… bun scripts/promote.ts \
//     --email someone@example.com --role superadmin|admin|user --yes
import { revokeAdminSessionsForUser } from "@shortn/core";
import {
  closeMongoClient,
  collection,
  confirmMongoTarget,
  getMongoClient,
  userRoles,
} from "@shortn/db";
import { ObjectId } from "mongodb";

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const email = option("--email")?.trim().toLowerCase();
const role = userRoles.find((item) => item === option("--role"));
if (!email || !role)
  throw new Error(`--email and --role (${userRoles.join(", ")}) are required`);
if (!args.includes("--yes")) throw new Error("This writes; pass --yes");

const url = process.env.MONGODB_URL;
const database = process.env.MONGODB_DB;
if (!url || !database) throw new Error("Set MONGODB_URL and MONGODB_DB");
confirmMongoTarget(url, database, args);
const db = (await getMongoClient({ url, database })).db(database);
try {
  const users = collection(db, "user");
  const user = await users.findOne({ email });
  if (!user) throw new Error(`No user ${email}`);
  const before = user.role ?? "user";
  if (before === "superadmin" && role !== "superadmin") {
    const others = await users.countDocuments({
      role: "superadmin",
      _id: { $ne: user._id },
    });
    if (others === 0) throw new Error("Refusing to demote the last superadmin");
  }
  await collection(db, "admin_audit_log").insertOne({
    _id: new ObjectId(),
    createdAt: new Date(),
    actorId: "script",
    actorEmail: "script",
    action: "user.role.update",
    targetType: "user",
    targetId: user._id.toHexString(),
    status: "succeeded",
    completedAt: new Date(),
    metadata: { before, after: role },
  });
  await users.updateOne(
    { _id: user._id },
    role === "user" ? { $unset: { role: "" } } : { $set: { role } },
  );
  const revoked = await revokeAdminSessionsForUser(db, user._id.toHexString());
  console.log(
    `${email}: ${before} → ${role}; admin sessions ended: ${revoked}`,
  );
  if (role !== "user" && user.twoFactorEnabled !== true)
    console.warn(
      "No authenticator enrolled: they must enable 2FA on app.shortn.at before they can sign in to the console.",
    );
} finally {
  await closeMongoClient();
}
