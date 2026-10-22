import { expect, test } from "bun:test";
import { adminCan, adminDenial, stepUpWindowMs } from "./permissions";

const now = new Date("2026-10-22T12:00:00Z");
const fresh = new Date(now.getTime() - 60_000);
const stale = new Date(now.getTime() - stepUpWindowMs - 1);

test("admins read and take plain actions without step-up", () => {
  const admin = { role: "admin" as const };
  expect(adminDenial(admin, "read", { now })).toBeNull();
  expect(adminDenial(admin, "domain.reverify", { now })).toBeNull();
  expect(
    adminDenial(admin, "link.takedown", { now, reason: "phishing" }),
  ).toBeNull();
});

test("superadmin-only actions are forbidden to admins even when elevated", () => {
  for (const action of [
    "user.role.update",
    "user.delete",
    "subscription.revoke",
    "user.impersonate.write",
    "link.takedown.bulk",
    "user.ban.staff",
  ] as const) {
    expect(adminCan({ role: "admin" }, action)).toBe(false);
    expect(
      adminDenial({ role: "admin", elevatedAt: fresh }, action, {
        now,
        reason: "r",
      }),
    ).toBe("forbidden");
    expect(adminCan({ role: "superadmin" }, action)).toBe(true);
  }
});

test("step-up actions need an elevation within the window", () => {
  const reason = "abuse";
  expect(adminDenial({ role: "admin" }, "user.ban", { now, reason })).toBe(
    "step_up_required",
  );
  expect(
    adminDenial({ role: "admin", elevatedAt: stale }, "user.ban", {
      now,
      reason,
    }),
  ).toBe("step_up_required");
  expect(
    adminDenial({ role: "admin", elevatedAt: fresh }, "user.ban", {
      now,
      reason,
    }),
  ).toBeNull();
});

test("a blank reason is refused only when a reason is being submitted", () => {
  const admin = { role: "admin" as const, elevatedAt: fresh };
  expect(adminDenial(admin, "user.ban", { now })).toBeNull();
  expect(adminDenial(admin, "user.ban", { now, reason: "  " })).toBe(
    "reason_required",
  );
  expect(adminDenial(admin, "report.resolve", { now, reason: "" })).toBeNull();
});
