import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { ObjectId, type Db } from "mongodb";
import { physicalNames } from "@shortn/db";
import { ensurePersonalWorkspace } from "@shortn/core";
import type { Browser } from "playwright-core";
import { SignJWT, decodeJwt } from "jose";

export interface CapturedEmail {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}

export async function checkEmailChange({
  browser,
  db,
  origin,
  emails,
  clientIp,
  authSecret,
  captureDir,
}: {
  browser: Browser;
  db: Db;
  origin: string;
  emails: CapturedEmail[];
  clientIp: string;
  authSecret: string;
  captureDir: string | undefined;
}) {
  const userId = new ObjectId();
  const email = `email-${userId}@example.org`;
  const next = `updated-${userId}@example.org`;
  const password = `Email1!${randomBytes(16).toString("hex")}`;
  const now = new Date();
  await db.collection(physicalNames.user).insertOne({
    _id: userId,
    name: "Email fixture",
    email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection(physicalNames.account).insertOne({
    _id: new ObjectId(),
    userId,
    accountId: userId.toHexString(),
    providerId: "credential",
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });
  const workspace = await ensurePersonalWorkspace(db, {
    id: userId.toHexString(),
    name: "Email fixture",
    email,
  });
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIp },
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  const verifiedContext = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIp },
  });
  await verifiedContext.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  const user = () => db.collection(physicalNames.user).findOne({ _id: userId });
  const mailFor = async (to: string) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const mail = emails.findLast((mail) =>
        (Array.isArray(mail.to) ? mail.to : [mail.to]).includes(to),
      );
      if (mail) return mail;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Expected email was not captured locally");
  };
  const verificationLink = (mail: CapturedEmail) => {
    const link = mail.html
      .match(/href="([^"<>]*\/api\/auth\/verify-email\?[^"<>]*)"/)?.[1]
      ?.replaceAll("&amp;", "&");
    assert(link, "Email has no verification link");
    assert.equal(new URL(link).origin, origin);
    return link;
  };
  try {
    await page.goto(`${origin}/login`);
    await page.locator('input[name="identifier"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(`**/${workspace.slug}/links`);
    await page.goto(`${origin}/${workspace.slug}/settings/account/email`);
    const taken = await db
      .collection(physicalNames.user)
      .findOne({ _id: { $ne: userId }, email: { $exists: true } });
    assert(taken);
    await page
      .getByRole("textbox", { name: "New email", exact: true })
      .fill(taken.email);
    await page
      .getByRole("button", { name: "Change email", exact: true })
      .click();
    await page
      .getByText("Another account already uses this email.", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("textbox", { name: "New email", exact: true })
        .inputValue(),
      taken.email,
    );
    await page
      .getByRole("textbox", { name: "New email", exact: true })
      .fill(next);
    await page
      .getByRole("button", { name: "Change email", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "We sent an approval link" })
      .waitFor();
    assert.equal((await user())?.email, email);
    const approval = verificationLink(await mailFor(email));
    const expiredLink = new URL(approval);
    const expiredToken = await new SignJWT(
      decodeJwt(expiredLink.searchParams.get("token")!),
    )
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(new TextEncoder().encode(authSecret));
    expiredLink.searchParams.set("token", expiredToken);
    await page.goto(expiredLink.href);
    await page
      .getByRole("status")
      .filter({ hasText: "This confirmation link has expired" })
      .waitFor();
    assert.equal((await user())?.email, email);
    await page.goto(approval);
    await page.waitForURL(`**/${workspace.slug}/settings/account/email*`);
    assert.equal((await user())?.email, email);
    await page
      .getByRole("status")
      .filter({ hasText: "Current address approved" })
      .waitFor();
    const verification = verificationLink(await mailFor(next));
    const verifiedPage = await verifiedContext.newPage();
    await verifiedPage.goto(verification);
    await verifiedPage.waitForURL(
      `**/${workspace.slug}/settings/account/email*`,
    );
    await verifiedPage
      .getByRole("status")
      .filter({ hasText: "Your email address has been changed" })
      .waitFor();
    assert.equal((await user())?.email, next);
    assert.equal((await user())?.emailVerified, true);
    assert.equal(
      await db.collection(physicalNames.session).countDocuments({ userId }),
      1,
    );
    await page.goto(`${origin}/${workspace.slug}/settings/account/email`);
    await page.waitForURL("**/login");
    if (captureDir) {
      for (const width of [1440, 390]) {
        await verifiedPage.setViewportSize({ width, height: 1000 });
        await verifiedPage.waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        await verifiedPage.screenshot({
          path: `${captureDir}/email-changed-${width}.png`,
        });
      }
    }
    await verifiedPage.goto(verification);
    await verifiedPage
      .getByRole("status")
      .filter({
        hasText: "This confirmation link is invalid or has already been used",
      })
      .waitFor();
    assert.equal((await user())?.email, next);
    await verifiedPage.evaluate(async () => {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    });
    await page.locator('input[name="identifier"]').fill(next);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(`**/${workspace.slug}/links`);
    console.log(
      "Email change passed: local mail capture, current-address approval, new-address verification and updated account.",
    );
  } finally {
    await context.close();
    await verifiedContext.close();
  }
}
