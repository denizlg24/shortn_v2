import { decodeSelection } from "../src/lib/bulk-selection";
import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { z } from "zod";
import { collection, physicalNames, type Documents } from "@shortn/db";
import { requestHealthCheck } from "@shortn/core";
const login = z
  .object({
    email: z.string(),
    password: z.string(),
    workspace: z.string(),
    workspaceId: z.string(),
    userId: z.string(),
    origin: z.string(),
  })
  .parse(JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")));
assert.equal(login.origin, "http://localhost:3200");
const client = await new MongoClient(
  "mongodb://127.0.0.1:27020/?directConnection=true",
).connect();
const db = client.db("shortn_p6_dev"),
  workspaceId = new ObjectId(login.workspaceId),
  tagId = new ObjectId();
const capture = !process.argv.includes("--functional-only");
const prefix = "p6-health-ui-",
  fixtures = { workspaceId, key: { $regex: `^${prefix}` } };
await collection(db, "links").deleteMany(fixtures);
await collection(db, "tags").insertOne({
  _id: tagId,
  workspaceId,
  tagName: "Health fixture",
  color: "#123456",
});
const now = new Date(),
  checked = new Date(now.getTime() - 12 * 3600000),
  since = new Date(now.getTime() - 14 * 86400000);
const rows = Array.from({ length: 1001 }, (_, index) => {
  const url = `https://destination.example.com/main/${index}`;
  const rules =
    index === 0 || index === 7
      ? {
          device: [
            {
              os: "ios" as const,
              url: `https://destination.example.com/long/${"long-label-".repeat(170)}`,
            },
          ],
          geo: [{ country: "PT", url: "https://destination.example.com/pt" }],
        }
      : undefined;
  const health: NonNullable<Documents["links"]["health"]> = requestHealthCheck(
    index === 4 ? "https://example.com/previous" : url,
    rules,
    now,
  );
  if (index !== 3) {
    health.completedAt = checked;
    health.nextAt = new Date(now.getTime() + 86400000);
    health.checks = health.targets.map((target) => {
      const bad =
        index === 0
          ? target.includes("/long/")
          : index === 5 || index % 17 === 0;
      const unknown = index === 2 || (index === 0 && target.endsWith("/pt"));
      return {
        url: target,
        checkedAt: checked,
        status: bad
          ? ("http_error" as const)
          : index === 6
            ? ("blocked" as const)
            : unknown
              ? ("unreachable" as const)
              : ("ok" as const),
        streak: bad ? (index === 5 ? 1 : 2) : 0,
        ...(bad
          ? { httpStatus: 503, failingSince: since }
          : index === 6
            ? { error: "destination_rejected" }
            : unknown
              ? { error: "timeout" }
              : { httpStatus: 200 }),
      };
    });
  }
  if (index === 7) {
    delete health.completedAt;
    health.checks = health.checks.slice(0, 1);
    health.remaining = health.targets.slice(1);
    health.iteration = 1;
    health.nextAt = now;
  }
  return {
    _id: new ObjectId(),
    workspaceId,
    createdBy: login.userId,
    domain: "shortn.at",
    key: `${prefix}${index === 0 ? "x".repeat(40) : index}`,
    urlCode: `${prefix}${index === 0 ? "x".repeat(40) : index}`,
    longUrl: url,
    title:
      index === 0
        ? "Synthetic long health fixture title ".repeat(20)
        : `Health fixture ${index}`,
    tags: [{ _id: tagId, tagName: "Health fixture" }],
    createdAt: new Date(now.getTime() - index * 1000),
    date: new Date(now.getTime() - index * 1000),
    updatedAt: now,
    isQrCode: false,
    safetyStatus: "safe",
    requiresInterstitial: false,
    disabled: false,
    clicks: { total: 0, lastClick: null },
    health,
    ...(rules ? { rules } : {}),
  };
});
await collection(db, "links").insertMany(rows);
const subscriptionId = new ObjectId();
await db.collection(physicalNames.subscriptions).insertOne({
  _id: subscriptionId,
  workspaceId,
  polarSubscriptionId: `health-ui-${crypto.randomUUID()}`,
  status: "active",
  plan: "pro",
  currentPeriodStart: new Date(now.getTime() - 86400000),
  currentPeriodEnd: new Date(now.getTime() + 29 * 86400000),
  cancelAtPeriodEnd: false,
});
const directory = "test-results/captures/p6-health-ui";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors: string[] = [],
  captures: object[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${login.origin}/login`);
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const storageState = await context.storageState();
  const base = `${login.origin}/${login.workspace}/links`,
    listUrl = `${base}?tag=Health+fixture`;
  await page.goto(listUrl);
  await page.locator("tbody tr").first().waitFor();
  assert.equal(await page.locator("tbody tr").count(), 25);
  assert.equal(await page.locator("[data-link-health-flag]").count(), 2);
  for (const n of [1, 2, 3, 4, 5, 6, 7])
    assert.equal(
      await page
        .locator("tbody tr")
        .nth(n)
        .locator("[data-link-health-flag]")
        .count(),
      0,
    );
  await page.locator('input[name="ids"]').first().check();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await page.locator('input[name="ids"]').first().check();
  await page.getByRole("status").filter({ hasText: "2 selected" }).waitFor();
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("Health fixture 5");
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .press("Enter");
  await page.waitForURL(
    (url) => url.searchParams.get("q") === "Health fixture 5",
  );
  await page.getByRole("status").filter({ hasText: "2 selected" }).waitFor();
  const selected = rows.slice(0, 500).map((row) => row._id.toHexString());
  await page.evaluate(
    ({ action, selected }) =>
      sessionStorage.setItem(
        `shortn:bulk-selection:${action}`,
        JSON.stringify(selected),
      ),
    { action: `/${login.workspace}/links/delete`, selected },
  );
  await page.goto(`${listUrl}&page=21`);
  await page.getByRole("status").filter({ hasText: "500 selected" }).waitFor();
  await page.locator('input[name="ids"]').first().click();
  assert.equal(
    await page.locator('input[name="ids"]').first().isChecked(),
    false,
  );
  await page
    .getByRole("alert")
    .filter({ hasText: "Select up to 500" })
    .waitFor();
  await page
    .getByRole("button", { name: "Delete selected", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname.endsWith("/links/delete"));
  assert.deepEqual(
    decodeSelection(new URL(page.url()).searchParams.get("selection")),
    selected,
  );
  assert(
    new URL(page.url()).pathname.length + new URL(page.url()).search.length <
      8192,
  );
  await page
    .getByRole("heading", { name: "Delete 500 links", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await page.goto(listUrl);
  const flag = page.locator("[data-link-health-flag]").first();
  await flag.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.hash === "#destination-health");
  await page.locator("#destination-health").waitFor();
  assert.equal(
    await page.locator("#destination-health details").getAttribute("open"),
    "",
  );
  await page.locator("#destination-health summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("#destination-health details").getAttribute("open"),
    null,
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#destination-health li").count(), 3);
  await context.close();
  for (const locale of ["en", "es", "pt"])
    for (const colorScheme of ["light", "dark"] as const)
      for (const viewport of [
        { width: 390, height: 1000 },
        { width: 1440, height: 1000 },
      ]) {
        const ctx = await browser.newContext({
          storageState,
          viewport,
          colorScheme,
        });
        await ctx.addCookies([
          { name: "NEXT_LOCALE", value: locale, url: login.origin },
        ]);
        await ctx.addInitScript(
          (theme) => localStorage.setItem("theme", theme),
          colorScheme,
        );
        const p = await ctx.newPage();
        p.on("pageerror", (error) => errors.push(error.message));
        for (const surface of ["list", "detail"]) {
          await p.goto(
            surface === "list" ? listUrl : `${base}/${rows[0]!._id}`,
          );
          await p
            .locator(surface === "list" ? "tbody tr" : "#destination-health")
            .first()
            .waitFor();
          await p.evaluate(() => document.fonts.ready);
          const metrics = await p.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            dark: document.documentElement.classList.contains("dark"),
            healthRows: document.querySelectorAll("#destination-health li")
              .length,
          }));
          assert.equal(metrics.overflow, false);
          assert.equal(metrics.dark, colorScheme === "dark");
          if (surface === "list") {
            assert.equal(await p.locator("tbody tr").count(), 25);
            assert.equal(await p.locator("[data-link-health-flag]").count(), 2);
          } else assert.equal(metrics.healthRows, 3);
          const path = `${directory}/${locale}-${surface}-${colorScheme}-${viewport.width}.png`;
          if (capture) await p.screenshot({ path, caret: "initial" });
          captures.push({
            path,
            locale,
            colorScheme,
            viewport,
            surface,
            metrics,
          });
        }
        if (
          locale === "en" &&
          colorScheme === "light" &&
          viewport.width === 390
        )
          for (const [index, state] of [
            [1, "healthy"],
            [2, "unreachable"],
            [3, "pending"],
            [4, "stale"],
            [5, "first-error"],
            [6, "blocked"],
            [7, "partial"],
          ] as const) {
            await p.goto(`${base}/${rows[index]!._id}`);
            await p.locator("#destination-health").waitFor();
            if (index === 1)
              await p
                .getByText("The latest checks returned no errors.", {
                  exact: true,
                })
                .waitFor();
            if (index === 3 || index === 4)
              await p
                .getByText("Waiting for the first check.", { exact: true })
                .waitFor();
            if (index === 2 || index === 5 || index === 6)
              await p.locator("#destination-health summary").click();
            if (index === 6)
              await p
                .getByText("Address could not be checked", { exact: true })
                .waitFor();
            if (index === 7)
              await p
                .getByText("First results are available.", { exact: true })
                .waitFor();
            assert(
              await p.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            );
            const path = `${directory}/en-${state}-light-390.png`;
            if (capture || index >= 6)
              await p.screenshot({ path, caret: "initial" });
            captures.push({
              path,
              locale,
              colorScheme,
              viewport,
              surface: state,
            });
          }
        await ctx.close();
      }
  assert.deepEqual(errors, []);
  if (capture)
    await writeFile(
      `${directory}/captures.json`,
      JSON.stringify(captures, null, 2),
    );
  else {
    const existing = JSON.parse(
      await readFile(`${directory}/captures.json`, "utf8"),
    ) as { surface: string }[];
    await writeFile(
      `${directory}/captures.json`,
      JSON.stringify(
        [
          ...existing.filter(
            (item) => !["blocked", "partial"].includes(item.surface),
          ),
          ...captures.filter((item) =>
            ["blocked", "partial"].includes(
              (item as { surface: string }).surface,
            ),
          ),
        ],
        null,
        2,
      ),
    );
  }
  console.log(
    "Health UI passed with 1,001 links: paged/tag-filtered list, selection across pages/filters, keyboard health navigation, native disclosure, all health states and locale/theme/viewport checks",
  );
} finally {
  await browser.close();
  await collection(db, "links").deleteMany(fixtures);
  await collection(db, "tags").deleteOne({ _id: tagId });
  await db
    .collection(physicalNames.subscriptions)
    .deleteOne({ _id: subscriptionId });
  await client.close();
}
