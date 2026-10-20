import { expect, test } from "bun:test";
import { adminElevationRefusal } from "./elevation";

const staff = {
  role: "admin" as const,
  emailVerified: true,
  twoFactorEnabled: true,
};

test("elevation requires a verified, unsuspended staff account with TOTP", () => {
  expect(adminElevationRefusal(staff)).toBeNull();
  expect(adminElevationRefusal({ ...staff, role: "superadmin" })).toBeNull();
  expect(adminElevationRefusal({ ...staff, role: "user" })).toBe("not_staff");
  expect(adminElevationRefusal({ ...staff, role: undefined })).toBe(
    "not_staff",
  );
  expect(adminElevationRefusal({ ...staff, banned: true })).toBe(
    "account_suspended",
  );
  expect(
    adminElevationRefusal({
      ...staff,
      banned: true,
      banExpires: new Date(Date.now() - 1000),
    }),
  ).toBeNull();
  expect(adminElevationRefusal({ ...staff, deletedAt: new Date() })).toBe(
    "account_suspended",
  );
  expect(adminElevationRefusal({ ...staff, emailVerified: false })).toBe(
    "email_not_verified",
  );
  expect(adminElevationRefusal({ ...staff, twoFactorEnabled: false })).toBe(
    "totp_required",
  );
});
