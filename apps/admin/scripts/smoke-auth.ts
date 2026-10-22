// Drives the console's half of elevation against a running dev server
// (doc 23 B1): login → callback → session → CSRF-checked logout → demotion.
// The app half is stood in for by writing the elevation token directly.
//   MONGODB_URL=… MONGODB_DB=… ADMIN_ORIGIN=http://localhost:3005 \
//     bun scripts/smoke-auth.ts
import { hashElevationSecret } from "@shortn/core";
import { closeMongoClient, collection, getMongoClient } from "@shortn/db";
import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";

const origin = process.env.ADMIN_ORIGIN ?? "http://localhost:3005";
const url = process.env.MONGODB_URL;
const database = process.env.MONGODB_DB;
if (!url || !database) throw new Error("Set MONGODB_URL and MONGODB_DB");
const db = (await getMongoClient({ url, database })).db(database);
const ua = "smoke-auth/1";
const jar = new Map<string, string>();
const send = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(new URL(path, origin), {
    redirect: "manual",
    ...init,
    headers: {
      "user-agent": ua,
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      ...init.headers,
    },
  });
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const [name, value] = pair!.split("=");
    if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(line)) jar.delete(name!);
    else jar.set(name!, value ?? "");
  }
  return response;
};
const check = (label: string, condition: boolean, detail = "") => {
  console.log(
    `${condition ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`,
  );
  if (!condition) process.exitCode = 1;
};

const userId = new ObjectId();
await collection(db, "user").insertOne({
  _id: userId,
  email: `smoke-${userId.toHexString()}@example.com`,
  role: "admin",
  emailVerified: true,
  twoFactorEnabled: true,
});
try {
  const anonymous = await send("/");
  check(
    "console redirects anonymous visitors to /login",
    anonymous.status === 307 &&
      anonymous.headers.get("location")?.endsWith("/login") === true,
    `${anonymous.status} ${anonymous.headers.get("location")}`,
  );
  check(
    "pages carry a nonce CSP and noindex",
    /script-src 'self' 'nonce-/.test(
      anonymous.headers.get("content-security-policy") ?? "",
    ) && anonymous.headers.get("x-robots-tag") === "noindex, nofollow",
  );

  const login = await send("/login?next=/users");
  const elevate = new URL(login.headers.get("location") ?? "");
  const nonceHash = elevate.searchParams.get("n") ?? "";
  check(
    "login hands off to the app with a nonce hash",
    elevate.pathname === "/admin/elevate" &&
      /^[a-f\d]{64}$/.test(nonceHash) &&
      elevate.searchParams.get("purpose") === "login",
  );

  const issue = async (purpose: "login" | "stepup", nonce = nonceHash) => {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    await collection(db, "admin_elevation_tokens").insertOne({
      _id: hashElevationSecret(token),
      userId: userId.toHexString(),
      nonceHash: nonce,
      purpose,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    return token;
  };

  const foreign = await issue("login", hashElevationSecret("someone-else"));
  const stolen = await send(`/auth/callback?t=${foreign}`);
  check(
    "a token bound to another browser's nonce is refused",
    stolen.headers.get("location")?.includes("/auth/error") === true,
  );

  const relogin = await send("/login?next=/users");
  const n2 =
    new URL(relogin.headers.get("location") ?? "").searchParams.get("n") ?? "";
  const token = await issue("login", n2);
  const callback = await send(`/auth/callback?t=${token}`);
  check(
    "callback creates a session and returns to next",
    callback.headers.get("location") === `${origin}/users` &&
      jar.has("shortn_admin"),
    `${callback.headers.get("location")}`,
  );
  const replay = await send(`/auth/callback?t=${token}`);
  check(
    "the token is single-use",
    replay.headers.get("location")?.includes("/auth/error") === true,
  );

  const home = await send("/");
  check(
    "the console renders for staff",
    home.status === 200 && (await home.text()).includes("Overview"),
  );
  check(
    "session create is audited",
    (await collection(db, "admin_audit_log").countDocuments({
      actorId: userId.toHexString(),
      action: "admin.session.create",
      status: "succeeded",
    })) === 1,
  );

  const csrf = await send("/logout", {
    method: "POST",
    headers: { origin: "https://evil.example" },
  });
  check("logout from a foreign origin is refused", csrf.status === 403);

  await collection(db, "user").updateOne(
    { _id: userId },
    { $set: { role: "user" } },
  );
  const demoted = await send("/");
  check(
    "demotion ends console access on the next request",
    demoted.status === 307,
  );
  check(
    "demotion deletes the admin sessions",
    (await collection(db, "admin_sessions").countDocuments({
      userId: userId.toHexString(),
    })) === 0,
  );

  await collection(db, "user").updateOne(
    { _id: userId },
    { $set: { role: "admin" } },
  );
  const n3 =
    new URL(
      (await send("/login")).headers.get("location") ?? "",
    ).searchParams.get("n") ?? "";
  await send(`/auth/callback?t=${await issue("login", n3)}`);
  const logout = await send("/logout", { method: "POST", headers: { origin } });
  check(
    "logout from the console origin signs out",
    logout.status === 303 && !jar.has("shortn_admin"),
  );
  check(
    "logout is audited",
    (await collection(db, "admin_audit_log").countDocuments({
      actorId: userId.toHexString(),
      action: "admin.session.revoke",
    })) === 1,
  );
} finally {
  await collection(db, "user").deleteOne({ _id: userId });
  await closeMongoClient();
}
