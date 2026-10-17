import { expect, test } from "bun:test";
import { contactInput, ticketId } from "./contact";

test("ticket ids keep legacy's shape", () => {
  expect(ticketId(new Date("2026-10-17T10:00:00Z"), () => 0)).toBe(
    "CT-20261017-AAAAA",
  );
  expect(ticketId(new Date())).toMatch(/^CT-\d{8}-[A-Z2-9]{5}$/);
});

test("contact input trims, bounds and rejects filled honeypots", () => {
  const valid = {
    name: " Ana ",
    email: "ana@example.com",
    topic: "sales",
    message: "We print 400 QR codes a month.",
    token: "t",
  };
  expect(contactInput.parse(valid).name).toBe("Ana");
  expect(contactInput.safeParse({ ...valid, message: "short" }).success).toBe(
    false,
  );
  expect(contactInput.safeParse({ ...valid, topic: "spam" }).success).toBe(
    false,
  );
  expect(contactInput.safeParse({ ...valid, website: "x" }).success).toBe(
    false,
  );
});
