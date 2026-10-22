import type { ObjectId } from "mongodb";

const locale = "en-GB";
const number = new Intl.NumberFormat(locale);
const dateTime = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const date = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const fmtNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : number.format(value);

export const fmtCount = (count: { value: number; capped: boolean }) =>
  count.capped ? `${number.format(count.value)}+` : number.format(count.value);

/** Times are shown in UTC everywhere in the console. */
export const fmtDateTime = (value: Date | null | undefined) =>
  value ? `${dateTime.format(value)} UTC` : "—";

export const fmtDate = (value: Date | null | undefined) =>
  value ? date.format(value) : "—";

export const createdAt = (id: ObjectId) => id.getTimestamp();

const units: [number, string][] = [
  [365 * 86_400_000, "y"],
  [30 * 86_400_000, "mo"],
  [7 * 86_400_000, "w"],
  [86_400_000, "d"],
  [3_600_000, "h"],
  [60_000, "m"],
];

/** "3d ago", "in 2h". */
export function fmtRelative(value: Date | null | undefined, now = new Date()) {
  if (!value) return "—";
  const delta = value.getTime() - now.getTime();
  const abs = Math.abs(delta);
  const unit = units.find(([size]) => abs >= size);
  if (!unit) return delta >= 0 ? "in <1m" : "just now";
  const amount = `${Math.floor(abs / unit[0])}${unit[1]}`;
  return delta >= 0 ? `in ${amount}` : `${amount} ago`;
}

export const fmtUsd = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);

/** Only scheme + host + a truncated path; never fetched. */
export function destinationParts(url: string | null | undefined) {
  if (!url) return { host: "—", path: "" };
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    return {
      host: parsed.host,
      path:
        path === "/" ? "" : path.length > 48 ? `${path.slice(0, 47)}…` : path,
    };
  } catch {
    return { host: url.slice(0, 64), path: "" };
  }
}
