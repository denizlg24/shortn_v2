import { strict as assert } from "node:assert";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { physicalNames } from "@shortn/db";
import { ensurePersonalWorkspace } from "@shortn/core";
import type { Browser } from "playwright-core";

/** Exercises the real exchange endpoint using legacy's hashed token document shape. */
export async function checkHandoffAndAddPassword({
  browser,
  db,
  origin,
  captureDir,
  clientIp,
}: {
  browser: Browser;
  db: Db;
  origin: string;
  captureDir: string | undefined;
  clientIp: string;
}) {
  const userId = new ObjectId();
  const email = `oauth-${userId}@example.org`;
  const now = new Date();
  await db.collection(physicalNames.user).insertOne({
    _id: userId,
    name: "OAuth fixture",
    email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection(physicalNames.account).insertOne({
    _id: new ObjectId(),
    userId,
    providerId: "github",
    accountId: userId.toHexString(),
    createdAt: now,
    updatedAt: now,
  });
  const workspace = await ensurePersonalWorkspace(db, {
    id: userId.toHexString(),
    name: "OAuth fixture",
    email,
  });
  const tokens = db.collection<{
    _id: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    impersonatedBy?: string;
  }>(physicalNames.handoff_tokens);
  const mint = async (
    options: {
      expiresAt?: Date;
      userId?: string;
      impersonatedBy?: string;
    } = {},
  ) => {
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    await tokens.insertOne({
      _id: hash,
      userId: options.userId ?? userId.toHexString(),
      expiresAt: options.expiresAt ?? new Date(Date.now() + 60_000),
      createdAt: new Date(),
      ...(options.impersonatedBy
        ? { impersonatedBy: options.impersonatedBy }
        : {}),
    });
    return { token, hash };
  };
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { "x-forwarded-for": clientIp },
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const endpoint = (token: string, next: string) =>
    `${origin}/api/auth/handoff?t=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
  const denied = async (
    token: string,
    next: string,
    expected: string | null,
  ) => {
    const result = await fetch(endpoint(token, next), {
      redirect: "manual",
      headers: { "x-forwarded-for": clientIp },
    });
    assert.equal(result.status, 302);
    assert.equal(
      new URL(result.headers.get("location")!, origin).pathname,
      "/login",
    );
    assert.equal(
      new URL(result.headers.get("location")!, origin).searchParams.get("next"),
      expected,
    );
    assert.equal(result.headers.get("set-cookie"), null);
  };
  try {
    const expired = await mint({ expiresAt: new Date(Date.now() - 1) });
    await denied(expired.token, "/?to=qr", "/?to=qr");
    await denied(
      randomBytes(32).toString("base64url"),
      "https://example.org/elsewhere",
      "/",
    );
    await denied(
      randomBytes(32).toString("base64url"),
      "//example.org/elsewhere",
      "/",
    );
    const missingUser = await mint({ userId: new ObjectId().toHexString() });
    await denied(missingUser.token, "/?to=qr", null);
    assert.equal(await tokens.countDocuments({ _id: missingUser.hash }), 0);
    assert.equal(
      await db.collection(physicalNames.session).countDocuments({ userId }),
      0,
    );
    const valid = await mint();
    await page.goto(
      endpoint(valid.token, "/?to=settings%2Faccount%2Fpassword"),
    );
    // Unsupported section names fall back to Links, matching the app landing route.
    await page.waitForURL(`**/${workspace.slug}/links`);
    assert.equal(await tokens.countDocuments({ _id: valid.hash }), 0);
    assert.equal(
      await db.collection(physicalNames.session).countDocuments({ userId }),
      1,
    );
    const cookies = await context.cookies();
    assert(
      cookies.some(
        (cookie) => cookie.name.includes("session_token") && cookie.httpOnly,
      ),
    );
    await denied(valid.token, "/?to=qr", "/?to=qr");
    assert.equal(
      await db.collection(physicalNames.session).countDocuments({ userId }),
      1,
    );
    await page.goto(`${origin}/${workspace.slug}/settings/account/password`);
    assert.equal(await page.locator('input[name="current"]').count(), 0);
    await page
      .getByRole("button", { name: "Add password", exact: true })
      .waitFor();
    if (captureDir) {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        await page.screenshot({
          path: `${captureDir}/add-password-${width}.png`,
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    const password = `New-password1!${randomBytes(16).toString("hex")}`;
    await page.locator('input[name="next"]').fill(password);
    await page
      .getByRole("button", { name: "Add password", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Password added" })
      .waitFor();
    await page.locator('input[name="current"]').waitFor();
    assert.equal(
      await db
        .collection(physicalNames.account)
        .countDocuments({ userId, providerId: "credential" }),
      1,
    );
    // The original provider remains linked when an email/password credential is added.
    assert.equal(
      await db
        .collection(physicalNames.account)
        .countDocuments({ userId, providerId: "github" }),
      1,
    );
    await page.evaluate(async () => {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    });
    await page.goto(`${origin}/login`);
    await page.locator('input[name="identifier"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(`**/${workspace.slug}/links`);
    await page.evaluate(async () => {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    });
    const adminId = new ObjectId().toHexString();
    const impersonated = await mint({ impersonatedBy: adminId });
    await page.goto(endpoint(impersonated.token, "/?to=qr"));
    await page.waitForURL(`**/${workspace.slug}/qr`);
    await page
      .getByRole("region", { name: "Impersonation", exact: true })
      .waitFor();
    const session = await db
      .collection(physicalNames.session)
      .findOne({ userId, impersonatedBy: adminId });
    assert(session);
    assert(
      Math.abs(new Date(session.expiresAt).getTime() - Date.now() - 3_600_000) <
        60_000,
    );
    await page.goto(`${origin}/${workspace.slug}/settings/account/sessions`);
    const refreshed = await db
      .collection(physicalNames.session)
      .findOne({ _id: session._id });
    assert.equal(
      new Date(refreshed!.expiresAt).getTime(),
      new Date(session.expiresAt).getTime(),
    );
    await page
      .getByRole("button", { name: "End session", exact: true })
      .click();
    await page.waitForURL("**/login");
    assert.equal(
      await db
        .collection(physicalNames.session)
        .countDocuments({ userId, impersonatedBy: adminId }),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "Handoff and OAuth-account password checks passed: one-time/expiry/redirect protection, section landing, added password sign-in and impersonation expiry/banner/end-session.",
    );
  } finally {
    await context.close();
  }
}
