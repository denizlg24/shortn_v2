import { expect, test } from "bun:test";
import { suspensionExemptPath } from "./workspace-suspension";

test("only billing and workspace export pages stay open while suspended", () => {
  for (const path of [
    "/acme/settings/billing",
    "/acme/settings/billing/invoices",
    "/acme/settings/workspace/export",
    "/acme/settings/workspace/exports",
    "/acme/settings/workspace/exports/0123456789abcdef01234567",
  ])
    expect(suspensionExemptPath(path)).toBe(true);
  for (const path of [
    "/acme/links",
    "/acme/settings",
    "/acme/settings/members",
    "/acme/settings/workspace",
    "/acme/settings/workspace/exports/not-an-id",
    "/acme/links/settings/billing",
  ])
    expect(suspensionExemptPath(path)).toBe(false);
});
