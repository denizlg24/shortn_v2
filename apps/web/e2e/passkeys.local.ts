import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
import { z } from "zod";

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
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const directory =
    process.env.PASSKEY_CAPTURE_DIR ?? ".impeccable/review/p6-passkeys/first",
  captures: object[] = [],
  errors: string[] = [];
const workspaceId = new ObjectId(login.workspaceId),
  userId = new ObjectId(login.userId),
  userFilter = { userId: { $in: [login.userId, userId] } };
const previous = await db
  .collection(physicalNames.workspaces)
  .findOne({ _id: workspaceId });
const settingsPath = `/${login.workspace}/settings/account/sign-in`,
  settings = login.origin + settingsPath;
let ip = 110;
const freshIp = () =>
  context.setExtraHTTPHeaders({ "x-forwarded-for": `192.0.2.${ip++}` });
page.on("pageerror", (error) => errors.push(error.message));
const cdp = await context.newCDPSession(page);
await cdp.send("WebAuthn.enable");
const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
  options: {
    protocol: "ctap2",
    transport: "internal",
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  },
});
async function capture(name: string, width: number) {
  if (process.env.PASSKEY_NO_CAPTURES === "1") return;
  await page.setViewportSize({ width, height: 1000 });
  if (new URL(page.url()).pathname.includes("/settings/"))
    await page.locator("#passkeys").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const height = await page.evaluate(() => {
    let extra = 0;
    for (const node of document.querySelectorAll<HTMLElement>("*"))
      if (
        ["auto", "scroll"].includes(getComputedStyle(node).overflowY) &&
        node.clientHeight > 0
      ) {
        node.scrollTop = 0;
        extra = Math.max(extra, node.scrollHeight - node.clientHeight);
      }
    window.scrollTo(0, 0);
    return Math.ceil(1000 + extra + (extra ? 80 : 0));
  });
  if (height > 1000) await page.setViewportSize({ width, height });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const file = `${directory}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  captures.push({
    file,
    width,
    viewportHeight: height,
    route: new URL(page.url()).pathname,
  });
}
async function passwordLogin() {
  await freshIp();
  await page.goto(
    `${login.origin}/login?next=${encodeURIComponent(settingsPath)}`,
  );
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(settings);
  await page.locator("#passkeys").waitFor();
}
async function signOut() {
  await page.evaluate(async () => {
    const r = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) throw Error("Synthetic sign-out failed");
  });
}
try {
  await mkdir(directory, { recursive: true });
  await db.collection(physicalNames.passkeys).deleteMany(userFilter);
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
  await capture("empty-en-light-1440", 1440);
  await capture("empty-en-light-390", 390);
  await page.locator('input[name="passkeyName"]').fill("Personal laptop");
  await freshIp();
  await page.getByRole("button", { name: "Add passkey", exact: true }).click();
  await page
    .getByText("Passkey added. You can use it the next time you sign in.", {
      exact: true,
    })
    .waitFor();
  const key = await db.collection(physicalNames.passkeys).findOne(userFilter);
  assert(key);
  assert.equal(key.name, "Personal laptop");
  const credentials = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  assert.equal(credentials.credentials.length, 1);
  assert.equal(credentials.credentials[0]!.isResidentCredential, true);
  const current = await page.evaluate(async () =>
    (await fetch("/api/auth/get-session")).json(),
  );
  await db
    .collection(physicalNames.session)
    .updateOne(
      { _id: new ObjectId(current.session.id) },
      { $set: { createdAt: new Date(Date.now() - 360000) } },
    );
  await page.locator('input[name="passkeyName"]').fill("Freshness check");
  await freshIp();
  await page.getByRole("button", { name: "Add passkey", exact: true }).click();
  await page
    .getByText("Sign in again before changing passkeys.", { exact: true })
    .waitFor();
  await capture("fresh-error-en-light-390", 390);
  await db
    .collection(physicalNames.session)
    .updateOne(
      { _id: new ObjectId(current.session.id) },
      { $set: { createdAt: new Date(current.session.createdAt) } },
    );
  // A large fixture exercises bounded server pagination without registering fake keys with the device.
  const synthetic = Array.from({ length: 27 }, (_, i) => ({
    _id: new ObjectId(),
    userId,
    name:
      i === 0
        ? "Work laptop — long recognizable label ".repeat(2).slice(0, 64)
        : `Synthetic archived device ${i + 1}`,
    credentialID: `p6-ui-${crypto.randomUUID()}`,
    publicKey: "synthetic-non-authenticating",
    counter: 0,
    createdAt: new Date(Date.now() - i * 1000),
  }));
  await db.collection(physicalNames.passkeys).insertMany(synthetic);
  await page.reload();
  await page.locator("#passkeys").waitFor();
  assert.equal(await page.locator("#passkeys li").count(), 25);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  assert.equal(await page.locator("#passkeys li").count(), 3);
  await capture("pagination-en-light-390", 390);
  await db
    .collection(physicalNames.passkeys)
    .deleteMany({ _id: { $in: synthetic.map((item) => item._id) } });
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
      await page.locator("#passkeys").waitFor();
      await page.waitForFunction(
        (value) =>
          document.documentElement.classList.contains("dark") ===
          (value === "dark"),
        theme,
      );
      for (const width of [1440, 390])
        await capture(`enrolled-${locale}-${theme}-${width}`, width);
    }
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await signOut();
  await page.goto(
    `${login.origin}/login?next=${encodeURIComponent(settingsPath)}`,
  );
  await page
    .getByRole("button", { name: "Sign in with a passkey", exact: true })
    .waitFor();
  await capture("login-en-dark-390", 390);
  for (const locale of ["pt", "es"]) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: login.origin },
    ]);
    await page.reload();
    await page.locator('input[name="identifier"]').waitFor();
    await capture(`login-${locale}-dark-390`, 390);
  }
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
  await page
    .getByRole("button", { name: "Sign in with a passkey", exact: true })
    .waitFor();
  await capture("login-en-light-1440", 1440);
  const loginButton = page.getByRole("button", {
    name: "Sign in with a passkey",
    exact: true,
  });
  await freshIp();
  await loginButton.click({ timeout: 5000 });
  await Promise.race([
    page.waitForURL(settings),
    page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('[role="alert"]')].some((n) =>
            n.textContent?.trim(),
          ),
        null,
        { timeout: 30000 },
      )
      .then(async () => {
        throw Error(
          (await page.locator('[role="alert"]').allTextContents()).join(" "),
        );
      }),
  ]);
  await page.locator("#passkeys").waitFor();
  const session = await page.evaluate(async () =>
    (await fetch("/api/auth/get-session")).json(),
  );
  assert.equal(session.session.passkeyId, String(key._id));
  await db
    .collection(physicalNames.workspaces)
    .updateOne(
      { _id: workspaceId },
      { $set: { "platformFeatures.advancedAuth": false } },
    );
  await page.reload();
  await page
    .getByText(
      "Adding passkeys is unavailable in your workspaces. Existing passkeys still work and can be removed.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("button", { name: "Remove Personal laptop", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove and sign out", exact: true })
    .waitFor();
  await capture("remove-disabled-en-light-390", 390);
  await freshIp();
  await page
    .getByRole("button", { name: "Remove and sign out", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/login");
  assert.equal(
    await db.collection(physicalNames.passkeys).countDocuments(userFilter),
    0,
  );
  assert.equal(
    await db.collection(physicalNames.session).countDocuments(userFilter),
    0,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  await writeFile(
    `${directory}/captures.json`,
    JSON.stringify(captures, null, 2) + "\n",
  );
  console.log(
    "Passkey browser enrollment, resident credential, verified sign-in, bounded pagination, flag removal, revocation and responsive locale/theme captures passed",
  );
} catch (error) {
  console.error("Browser errors:", errors);
  console.error(
    "Alerts:",
    await page.locator('[role="alert"]').allTextContents(),
  );
  console.error("Location:", page.url());
  throw error;
} finally {
  await db.collection(physicalNames.passkeys).deleteMany(userFilter);
  await db
    .collection(physicalNames.workspaces)
    .updateOne(
      { _id: workspaceId },
      { $set: { platformFeatures: previous?.platformFeatures ?? {} } },
    );
  await browser.close();
  await mongo.close();
}
