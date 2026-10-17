import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
import { z } from "zod";
import jsQR from "jsqr";

const login = z
  .object({
    origin: z.literal("http://localhost:3200"),
    email: z.string(),
    password: z.string(),
    userId: z.string(),
    workspaceId: z.string(),
    workspace: z.string(),
  })
  .parse(JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")));
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const directory = ".impeccable/review/p6-two-factor",
  captures: object[] = [],
  errors: string[] = [];
const workspaceId = new ObjectId(login.workspaceId),
  userId = new ObjectId(login.userId);
const previous = await db
  .collection(physicalNames.workspaces)
  .findOne({ _id: workspaceId });
let ip = 80;
const freshIp = () =>
  context.setExtraHTTPHeaders({ "x-forwarded-for": `192.0.2.${ip++}` });
const settings = `${login.origin}/${login.workspace}/settings/account/password`;
page.on("pageerror", (error) => errors.push(error.message));
function totp(encoded: string, ahead = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...encoded.toUpperCase().replace(/=+$/, "")]
    .map((value) => alphabet.indexOf(value).toString(2).padStart(5, "0"))
    .join("");
  const secret = Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
      parseInt(bits.slice(i * 8, i * 8 + 8), 2),
    ),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + ahead));
  const digest = createHmac("sha1", secret).update(counter).digest(),
    offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function capture(name: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  if (new URL(page.url()).pathname.includes("/settings/"))
    await page.locator("#two-factor").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const height = await page.evaluate(() => {
    let extra = 0;
    for (const node of document.querySelectorAll<HTMLElement>("*")) {
      if (
        ["auto", "scroll"].includes(getComputedStyle(node).overflowY) &&
        node.clientHeight > 0
      ) {
        node.scrollTop = 0;
        extra = Math.max(extra, node.scrollHeight - node.clientHeight);
      }
    }
    window.scrollTo(0, 0);
    return Math.max(1000, Math.ceil(1000 + extra + (extra ? 80 : 0)));
  });
  if (height > 1000) await page.setViewportSize({ width, height });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.waitForFunction(
    () => document.documentElement.scrollWidth <= innerWidth,
  );
  const file = `${directory}/${name}.png`,
    shot = await page.screenshot({ path: file, fullPage: true });
  captures.push({
    file,
    width,
    height: shot.readUInt32BE(20),
    viewportHeight: height,
    route: new URL(page.url()).pathname,
    fullPage: true,
  });
}
async function passwordLogin() {
  await freshIp();
  await page.goto(
    `${login.origin}/login?next=${encodeURIComponent(`/${login.workspace}/settings/account/password`)}`,
  );
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
}
async function signOut() {
  await page.evaluate(async () => {
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw Error("Synthetic sign-out failed");
  });
}
async function codes() {
  return (
    await page
      .getByRole("list", { name: "Recovery codes", exact: true })
      .locator("li")
      .allTextContents()
  ).map((value) => value.trim());
}
try {
  await mkdir(directory, { recursive: true });
  await db
    .collection(physicalNames.user)
    .updateOne({ _id: userId }, { $set: { twoFactorEnabled: false } });
  await db.collection(physicalNames.two_factor).deleteMany({ userId });
  await db
    .collection(physicalNames.workspaces)
    .updateOne(
      { _id: workspaceId },
      { $set: { "platformFeatures.advancedAuth": true } },
    );
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await passwordLogin();
  await page.waitForURL(settings);
  await page.getByText("Authenticator not enabled", { exact: true }).waitFor();
  await capture("off-en-light-1440", 1440);
  await page.locator('input[name="totpPassword"]').fill(login.password);
  await freshIp();
  await page
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  await page
    .getByRole("img", { name: "Authenticator setup QR code" })
    .waitFor();
  const recovery = await codes();
  assert.equal(recovery.length, 10);
  await page.getByText("Enter the setup key manually", { exact: true }).click();
  const secret = (await page.locator("details p").textContent())!.trim();
  assert.match(secret, /^[A-Z2-7]+$/);
  await capture("setup-en-light-1440", 1440);
  await capture("setup-en-light-390", 390);
  // The browser-generated QR is decoded independently from its rendered SVG.
  const qr = page.getByRole("img", { name: "Authenticator setup QR code" });
  const pixels = await qr.evaluate(async (svg) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 720;
    const ctx = canvas.getContext("2d")!,
      image = new Image();
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml",
      }),
    );
    try {
      image.src = url;
      await image.decode();
      ctx.drawImage(image, 0, 0, 720, 720);
      const pixels = ctx.getImageData(0, 0, 720, 720);
      return Array.from(pixels.data);
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  const uri = jsQR(new Uint8ClampedArray(pixels), 720, 720)?.data;
  assert.equal(new URL(uri!).searchParams.get("secret"), secret);
  await page
    .getByRole("checkbox", { name: "I have saved my recovery codes." })
    .check();
  const usedCode = totp(secret);
  await page.locator('input[name="totpCode"]').fill(usedCode);
  await freshIp();
  await page
    .getByRole("button", {
      name: "Enable two-factor authentication",
      exact: true,
    })
    .click();
  await page
    .getByText(
      "Two-factor authentication is on. Your other sessions have been signed out.",
      { exact: true },
    )
    .waitFor();
  await capture("enabled-codes-en-light-390", 390);
  assert.equal(
    await page.getByRole("button", { name: "Finish", exact: true }).isEnabled(),
    true,
  );
  await page
    .getByRole("checkbox", { name: "I have saved my recovery codes." })
    .check();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  assert.equal(
    await page
      .getByRole("list", { name: "Recovery codes", exact: true })
      .count(),
    0,
  );
  await signOut();
  await passwordLogin();
  await page.waitForURL((url) => url.pathname === "/login/two-factor");
  await capture("challenge-en-light-390", 390);
  await page.locator('input[name="code"]').fill(usedCode);
  await freshIp();
  await page
    .getByRole("button", { name: "Verify and sign in", exact: true })
    .click();
  await page
    .getByText(
      "That code has already been used. Wait for a new code in your authenticator app.",
      { exact: true },
    )
    .waitFor();
  await capture("replay-en-light-390", 390);
  await page.locator('input[name="code"]').fill(totp(secret, 1));
  await freshIp();
  await page
    .getByRole("button", { name: "Verify and sign in", exact: true })
    .click();
  await page.waitForURL(settings);
  await signOut();
  await passwordLogin();
  await page.waitForURL((url) => url.pathname === "/login/two-factor");
  await page
    .getByRole("button", { name: "Use a recovery code", exact: true })
    .click();
  await page.locator('input[name="code"]').fill(recovery[0]!);
  await freshIp();
  await page
    .getByRole("button", { name: "Verify and sign in", exact: true })
    .click();
  await page.waitForURL(settings);
  await page
    .getByRole("button", { name: "Replace recovery codes", exact: true })
    .click();
  await page.locator('input[name="totpPassword"]').fill(login.password);
  await freshIp();
  await page
    .getByRole("button", { name: "Replace recovery codes", exact: true })
    .click();
  await page
    .getByText(
      "Your previous recovery codes no longer work. Save this new set.",
      { exact: true },
    )
    .waitFor();
  const rotated = await codes();
  assert.equal(rotated.length, 10);
  assert(rotated.every((value) => !recovery.includes(value)));
  await capture("rotated-en-light-390", 390);
  await page
    .getByRole("checkbox", { name: "I have saved my recovery codes." })
    .check();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  for (const locale of ["en", "pt", "es"])
    for (const theme of ["light", "dark"]) {
      await context.addCookies([
        { name: "NEXT_LOCALE", value: locale, url: login.origin },
      ]);
      await page.evaluate(
        (value) => localStorage.setItem("theme", value),
        theme,
      );
      await page.goto(settings);
      await page.locator("#two-factor").waitFor();
      await page.waitForFunction(
        (value) =>
          document.documentElement.classList.contains("dark") ===
          (value === "dark"),
        theme,
      );
      for (const width of [1440, 390])
        await capture(`enabled-${locale}-${theme}-${width}`, width);
    }
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.goto(settings);
  await page
    .getByRole("button", {
      name: "Turn off two-factor authentication",
      exact: true,
    })
    .click();
  await page.locator('input[name="totpPassword"]').fill(login.password);
  await page
    .getByRole("checkbox", { name: /I understand that password sign-in/ })
    .check();
  await capture("disable-en-dark-390", 390);
  await freshIp();
  await page
    .getByRole("button", {
      name: "Turn off two-factor authentication",
      exact: true,
    })
    .click();
  await page
    .getByText(
      "Two-factor authentication is off. Your other sessions have been signed out.",
      { exact: true },
    )
    .waitFor();
  await signOut();
  await passwordLogin();
  await page.waitForURL(settings);
  assert.equal(
    (await db.collection(physicalNames.user).findOne({ _id: userId }))
      ?.twoFactorEnabled,
    false,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  await writeFile(
    `${directory}/captures.json`,
    JSON.stringify(captures, null, 2) + "\n",
  );
  console.log(
    "TOTP setup, independently decoded QR, password challenge, replay rejection, recovery, rotation, disabling, and localized responsive captures passed",
  );
} finally {
  await db
    .collection(physicalNames.workspaces)
    .updateOne(
      { _id: workspaceId },
      { $set: { platformFeatures: previous?.platformFeatures ?? {} } },
    );
  await db
    .collection(physicalNames.user)
    .updateOne({ _id: userId }, { $set: { twoFactorEnabled: false } });
  await db.collection(physicalNames.two_factor).deleteMany({ userId });
  await browser.close();
  await mongo.close();
}
