import { createApiKeyInput } from "@shortn/core";

// HTML dates have no timezone. Expiration is midnight UTC on the chosen day.
export function parseApiKeyForm(form: FormData, now = new Date()) {
  const rawDate = form.get("expiresOn");
  let expiresAt: Date | undefined;
  if (rawDate) {
    if (typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate))
      return {
        ok: false,
        error: "invalid_expiry",
        field: "expiresOn",
      } as const;
    expiresAt = new Date(`${rawDate}T00:00:00.000Z`);
    if (
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.toISOString().slice(0, 10) !== rawDate ||
      expiresAt <= now
    )
      return {
        ok: false,
        error: "invalid_expiry",
        field: "expiresOn",
      } as const;
  }
  const rawIps = form.get("ipAllowlist");
  const parsed = createApiKeyInput.safeParse({
    name: form.get("name"),
    scopes: form.getAll("scopes"),
    ...(expiresAt ? { expiresAt } : {}),
    ipAllowlist:
      typeof rawIps === "string" ? rawIps.split(/[\s,]+/).filter(Boolean) : [],
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return { ok: false, error: "invalid_input", field } as const;
  }
  return { ok: true, value: parsed.data } as const;
}
