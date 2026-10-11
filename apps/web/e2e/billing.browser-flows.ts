import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import type { Db, ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
import type { Page } from "playwright-core";
import { orderFixture } from "../../../packages/billing/test-fixtures/order";

export interface BillingFixture {
  order?: ReturnType<typeof orderFixture>;
  invoiceUrl?: string;
  failInvoice?: boolean;
}

export interface BillingRequest {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

export async function checkBillingFailures({
  page,
  go,
  db,
  workspaceId,
  userId,
  requests,
  writesEnabled,
  captureDir,
  fixture,
}: {
  page: Page;
  go: (path: string) => Promise<unknown>;
  db: Db;
  workspaceId: ObjectId;
  userId: string;
  requests: BillingRequest[];
  writesEnabled: boolean;
  captureDir: string | undefined;
  fixture: BillingFixture;
}) {
  const subscriptions = db.collection(physicalNames.subscriptions);
  const members = db.collection(physicalNames.workspace_members);
  const original = await subscriptions.findOne({ workspaceId });
  assert(original);
  const membership = await members.findOne({ workspaceId, userId });
  assert(membership);
  const base = "/settings/billing";
  const generic = "Something went wrong on our side. Try again.";
  const failedForm = async (name: string) => {
    const button = page.getByRole("button", { name, exact: true });
    await button.click();
    await page.getByRole("alert").filter({ hasText: generic }).waitFor();
    assert(await button.isEnabled(), `${name} can be retried`);
  };
  try {
    await subscriptions.deleteOne({ _id: original._id });
    await go(`${base}/plans`);
    await page
      .getByText("≈ €4.00/month, billed as $5/month", { exact: true })
      .waitFor();
    await failedForm("Upgrade to Basic");
    assert(requests.some((request) => request.path.includes("/checkouts")));
    assert.equal(await subscriptions.countDocuments({ workspaceId }), 0);
    await subscriptions.insertOne(original);

    await go(base);
    await page
      .getByText("≈ €20.00/month, billed as $25/month", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Open billing portal", exact: true })
      .click();
    await page.waitForURL(/failed=portal/);
    await page
      .getByRole("status")
      .filter({ hasText: "Couldn’t open billing. Try again." })
      .waitFor();
    assert(
      requests.some((request) => request.path.includes("/customer-sessions")),
    );

    fixture.order = orderFixture(
      original.polarSubscriptionId,
      original.polarCustomerId,
      userId,
    );
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByText("TEST-2026-001", { exact: true }).waitFor();
    await page
      .getByRole("cell", { name: "Partially refunded", exact: true })
      .waitFor();
    assert((await page.getByRole("table").innerText()).includes("€12.30"));
    assert(
      (await page.getByRole("table").innerText()).includes("€1.23 refunded"),
    );
    const orderRequest = requests.findLast((request) =>
      request.path.startsWith("/v1/orders/?"),
    );
    assert(orderRequest);
    const orderQuery = new URL(orderRequest.path, "http://localhost")
      .searchParams;
    assert.deepEqual(orderQuery.getAll("subscription_id"), [
      original.polarSubscriptionId,
    ]);
    assert.equal(orderQuery.get("external_customer_id"), userId);
    if (captureDir) {
      await mkdir(captureDir, { recursive: true });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        await page.screenshot({
          path: `${captureDir}/billing-history-${width}.png`,
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    fixture.order.is_invoice_generated = false;
    await go(base);
    await page
      .getByRole("button", {
        name: "Prepare invoice TEST-2026-001",
        exact: true,
      })
      .click();
    await page.waitForURL(/pending=invoice/);
    await page
      .getByRole("status")
      .filter({ hasText: "Your invoice is being prepared" })
      .waitFor();
    assert(
      requests.some((r) => r.method === "POST" && r.path.endsWith("/invoice")),
    );
    await page
      .getByRole("button", {
        name: "Download invoice TEST-2026-001",
        exact: true,
      })
      .waitFor();

    // An order returned for another workspace must never yield an invoice URL.
    fixture.order.subscription_id = "other-workspace-subscription";
    const invoiceReads = requests.filter((request) =>
      request.path.endsWith("/invoice"),
    ).length;
    await page
      .getByRole("button", {
        name: "Download invoice TEST-2026-001",
        exact: true,
      })
      .click();
    await page.waitForURL(/failed=invoice/);
    assert.equal(
      requests.filter((request) => request.path.endsWith("/invoice")).length,
      invoiceReads,
    );
    fixture.order.subscription_id = original.polarSubscriptionId;
    await go(base);
    fixture.failInvoice = true;
    await page
      .getByRole("button", {
        name: "Download invoice TEST-2026-001",
        exact: true,
      })
      .click();
    await page.waitForURL(/failed=invoice/);
    await page
      .getByRole("status")
      .filter({ hasText: "Couldn’t download the invoice." })
      .waitFor();
    fixture.failInvoice = false;
    await page.route(fixture.invoiceUrl!, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "Local invoice fixture",
      }),
    );
    await page
      .getByRole("button", {
        name: "Download invoice TEST-2026-001",
        exact: true,
      })
      .click();
    await page.waitForURL(fixture.invoiceUrl!);
    assert(
      (await page.locator("body").innerText()).includes(
        "Local invoice fixture",
      ),
    );
    fixture.order = undefined;

    if (writesEnabled) {
      await go(`${base}/plans/plus`);
      await failedForm("Switch to Plus");
      assert.equal(
        (await subscriptions.findOne({ _id: original._id }))?.plan,
        "pro",
      );
      await go(`${base}/cancel`);
      await failedForm("Cancel plan");
      assert.equal(
        (await subscriptions.findOne({ _id: original._id }))?.cancelAtPeriodEnd,
        false,
      );
      if (captureDir) {
        await mkdir(captureDir, { recursive: true });
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.waitForFunction(
            () => document.documentElement.scrollWidth <= innerWidth,
          );
          await page.screenshot({
            path: `${captureDir}/billing-cancel-error-${width}.png`,
          });
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      await subscriptions.updateOne(
        { _id: original._id },
        { $set: { cancelAtPeriodEnd: true } },
      );
      await go(base);
      await page.getByRole("button", { name: "Keep Pro", exact: true }).click();
      await page.waitForURL(/failed=resume/);
      await page.getByRole("status").filter({ hasText: generic }).waitFor();
      assert.equal(
        (await subscriptions.findOne({ _id: original._id }))?.cancelAtPeriodEnd,
        true,
      );
      assert.equal(
        requests.filter(
          (request) =>
            request.method === "PATCH" &&
            request.path.includes("/subscriptions/"),
        ).length,
        3,
      );
    } else {
      await go(`${base}/plans`);
      await page
        .getByRole("link", { name: "Manage plan on shortn.at", exact: true })
        .first()
        .waitFor();
      await go(`${base}/cancel`);
      await page.waitForURL((url) => url.pathname.endsWith(base));
      assert.equal(
        requests.filter((request) => request.method === "PATCH").length,
        0,
      );
    }
    await members.updateOne(
      { _id: membership._id },
      { $set: { role: "viewer" } },
    );
    const count = requests.length;
    await go(`${base}/plans`);
    await page
      .getByText(
        "Only the workspace owner can change the plan or see invoices.",
        { exact: true },
      )
      .first()
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: /Upgrade to|Switch to/ }).count(),
      0,
    );
    await go(base);
    assert.equal(
      await page
        .getByRole("button", { name: "Open billing portal", exact: true })
        .count(),
      0,
    );
    assert.equal(requests.length, count);
    console.log(
      `Billing provider failures, retry controls and permissions passed (writes ${writesEnabled ? "enabled" : "disabled"})`,
    );
  } finally {
    fixture.order = undefined;
    await subscriptions.replaceOne({ _id: original._id }, original, {
      upsert: true,
    });
    await members.updateOne(
      { _id: membership._id },
      { $set: { role: membership.role } },
    );
  }
}
