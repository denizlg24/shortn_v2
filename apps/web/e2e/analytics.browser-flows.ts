import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
import type { Page } from "playwright-core";

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\n")) {
      row.push(cell);
      cell = "";
      if (char === "\n") {
        rows.push(row);
        row = [];
      }
    } else cell += char;
  }
  const header = rows.shift()!;
  return rows.map((values) =>
    Object.fromEntries(header.map((key, at) => [key, values[at]])),
  );
}

export async function checkAnalyticsBrowser({
  page,
  go,
  db,
  workspaceId,
  linkId,
  linkKey,
  secondLinkId,
  secondLinkKey,
  qrId,
  qrKey,
  campaignId,
}: {
  page: Page;
  go: (path: string) => Promise<unknown>;
  db: Db;
  workspaceId: ObjectId;
  linkId: string;
  linkKey: string;
  secondLinkId: string;
  secondLinkKey: string;
  qrId: string;
  qrKey: string;
  campaignId: string;
}) {
  const backing = await db
    .collection(physicalNames.links)
    .findOne({ urlCode: qrKey });
  assert(backing);
  const event = (
    id: ObjectId,
    key: string,
    source: string,
    country = "PT",
    campaign = "Autumn",
    kind = "click",
    owner = workspaceId,
  ) => ({
    ts: new Date(Date.now() - 120_000),
    m: { workspaceId: owner, linkId: id, key, kind },
    ipHash: source,
    country,
    city: 'City, "Centre"',
    device: country === "PT" ? "mobile" : "desktop",
    browser: "Chrome",
    os: "macOS",
    refDomain: "example.org",
    utm: {
      source,
      medium: "email",
      campaign,
      term: "=1+1",
      content: 'first,"quoted"\nsecond line',
    },
  });
  await db
    .collection(physicalNames.click_events)
    .insertMany([
      event(new ObjectId(linkId), linkKey, "newsletter"),
      event(new ObjectId(linkId), linkKey, "partner", "DK"),
      event(new ObjectId(linkId), linkKey, "other-campaign", "PT", "Other"),
      event(new ObjectId(secondLinkId), secondLinkKey, "other-link"),
      event(backing._id, qrKey, "qr-only", "PT", "", "scan"),
      event(
        new ObjectId(),
        "foreign",
        "foreign-workspace",
        "PT",
        "Autumn",
        "click",
        new ObjectId(),
      ),
    ]);
  const stat = async (label: string, value: string) => {
    await page.waitForFunction(
      ({ label, value }) => {
        const term = [...document.querySelectorAll("dl dt")].find(
          (element) => element.textContent === label,
        );
        return (
          term?.parentElement?.querySelector("dd > span")?.textContent === value
        );
      },
      { label, value },
      { timeout: 15_000 },
    );
  };
  const download = async () => {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV", exact: true }).click();
    const file = await pending;
    assert.equal(await file.failure(), null);
    assert.match(file.suggestedFilename(), /^shortn-.*\.csv$/);
    const path = await file.path();
    assert(path);
    return csvRows(await readFile(path, "utf8"));
  };

  await go("/analytics");
  await stat("Clicks", "4");
  await stat("QR scans", "1");
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("click");
  await page.waitForURL(/kind=click/);
  await page.getByRole("combobox", { name: "Country", exact: true }).click();
  await page.getByRole("option", { name: "Portugal", exact: true }).click();
  await page.waitForURL(/country=PT/);
  await stat("Clicks", "3");
  await stat("QR scans", "0");
  const filtered = await download();
  assert.deepEqual(filtered.map((row) => row.utm_source).sort(), [
    "newsletter",
    "other-campaign",
    "other-link",
  ]);
  assert(filtered.every((row) => row.country === "PT" && row.kind === "click"));
  assert.equal(filtered[0]?.utm_term, "'=1+1");
  assert.equal(filtered[0]?.city, 'City, "Centre"');
  assert.equal(filtered[0]?.utm_content, 'first,"quoted"\nsecond line');

  await go(`/campaigns/${campaignId}/analytics?link=${linkId}`);
  await stat("Clicks", "2");
  const campaign = await download();
  assert.deepEqual(
    campaign.map((row) => row.utm_source).sort(),
    ["newsletter", "partner"],
    "Campaign exports keep campaign scope when a link filter is active",
  );
  await page
    .getByRole("link", { name: "See all UTM sources", exact: true })
    .click();
  await page.waitForURL(
    (url) =>
      url.pathname.endsWith("/analytics/utm-source") &&
      url.searchParams.get("campaign") === campaignId,
  );
  const table = page.getByRole("table", { name: "UTM sources", exact: true });
  await table.getByText("newsletter", { exact: true }).waitFor();
  assert.equal(await table.getByRole("row").count(), 3);
  assert.deepEqual((await download()).map((row) => row.Value).sort(), [
    "newsletter",
    "partner",
  ]);
  await table.getByRole("link", { name: "UTM source", exact: true }).click();
  await page.waitForURL(
    (url) =>
      url.searchParams.get("sort") === "name" &&
      url.searchParams.get("campaign") === campaignId,
  );
  await page.getByRole("link", { name: "Clear all", exact: true }).click();
  await page.waitForURL(
    (url) =>
      url.searchParams.get("campaign") === campaignId &&
      !url.searchParams.has("link"),
  );
  await table.getByRole("link", { name: "newsletter", exact: true }).click();
  await page.waitForURL(
    (url) =>
      url.pathname.endsWith(`/campaigns/${campaignId}/analytics`) &&
      url.searchParams.get("utmSource") === "newsletter",
  );
  await stat("Clicks", "1");
  await go(`/campaigns/${campaignId}/analytics?link=${secondLinkId}`);
  await stat("Clicks", "0");
  assert.equal(
    (await download()).length,
    0,
    "A link outside a campaign cannot widen its export",
  );
  await go(`/links/${linkId}/analytics?country=DK`);
  await stat("Clicks", "1");
  assert.deepEqual(
    (await download()).map((row) => row.utm_source),
    ["partner"],
  );
  await go(`/qr/${qrId}/analytics`);
  await stat("QR scans", "1");
  console.log(
    "Analytics passed: real filtered totals, CSV scope/escaping, campaign-link intersections and QR scans.",
  );
}
