import { isCreatedWindow } from "@shortn/core/links-filters";

const dayMs = 86_400_000;

/** Calendar date filters use UTC, independently of the server's time zone. */
export function utcDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

interface Params {
  get(name: string): string | null;
}

export function createdBounds(params: Params, now: Date) {
  const preset = params.get("created");
  if (isCreatedWindow(preset))
    return { createdAfter: new Date(now.getTime() - Number(preset) * dayMs) };
  if (preset !== "custom") return {};
  const from = utcDay(params.get("from"));
  const to = utcDay(params.get("to"));
  const [start, end] = from && to && from > to ? [to, from] : [from, to];
  return {
    ...(start ? { createdAfter: start } : {}),
    // An exclusive next-day bound includes every instant of the selected day.
    ...(end ? { createdBefore: new Date(end.getTime() + dayMs) } : {}),
  };
}

export function normalizeCreated(
  next: URLSearchParams,
  current: URLSearchParams,
  now: Date,
) {
  next.delete("page");
  if (next.get("created") !== "custom") {
    next.delete("from");
    next.delete("to");
    return next;
  }
  for (const name of ["from", "to"])
    if (!utcDay(next.get(name))) next.delete(name);
  if (
    current.get("created") !== "custom" &&
    !next.has("from") &&
    !next.has("to")
  ) {
    next.set(
      "from",
      new Date(now.getTime() - 29 * dayMs).toISOString().slice(0, 10),
    );
    next.set("to", now.toISOString().slice(0, 10));
  }
  const from = next.get("from");
  const to = next.get("to");
  if (from && to && from > to) {
    next.set("from", to);
    next.set("to", from);
  }
  return next;
}
