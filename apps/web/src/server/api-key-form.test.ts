import { expect, test } from "bun:test";
import { parseApiKeyForm } from "./api-key-form";

const now = new Date("2026-10-12T12:00:00Z");
function form() {
  const data = new FormData();
  data.set("name", " Newsletter ");
  data.append("scopes", "links:read");
  return data;
}
test("API key forms parse UTC expiration and separated IP restrictions", () => {
  const data = form();
  data.set("expiresOn", "2026-10-13");
  data.set("ipAllowlist", "192.0.2.1, 192.0.2.0/24\n2001:db8::/32");
  const result = parseApiKeyForm(data, now);
  if (!result.ok) throw new Error(result.error);
  expect(result.value.name).toBe("Newsletter");
  expect(result.value.expiresAt?.toISOString()).toBe(
    "2026-10-13T00:00:00.000Z",
  );
  expect(result.value.ipAllowlist).toEqual([
    "192.0.2.1",
    "192.0.2.0/24",
    "2001:db8::/32",
  ]);
});
test("API key forms reject past dates and calendar overflow", () => {
  for (const value of [
    "2026-10-12",
    "2026-02-30",
    "2026-13-01",
    "not a date",
    "2026-10-13T12:00:00Z",
  ]) {
    const data = form();
    data.set("expiresOn", value);
    expect(parseApiKeyForm(data, now)).toEqual({
      ok: false,
      error: "invalid_expiry",
      field: "expiresOn",
    });
  }
});
test("API key forms report missing scopes, invalid IPs, and invalid names", () => {
  const empty = form();
  empty.delete("scopes");
  expect(parseApiKeyForm(empty, now)).toMatchObject({
    ok: false,
    field: "scopes",
  });
  const badIp = form();
  badIp.set("ipAllowlist", "192.0.2.0/33");
  expect(parseApiKeyForm(badIp, now)).toMatchObject({
    ok: false,
    field: "ipAllowlist",
  });
  const badName = form();
  badName.set("name", " ");
  expect(parseApiKeyForm(badName, now)).toMatchObject({
    ok: false,
    field: "name",
  });
  const valid = parseApiKeyForm(form(), now);
  expect(valid.ok && valid.value.expiresAt).toBeUndefined();
});
