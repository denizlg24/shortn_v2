import type { UIStrings } from "../i18n/strings";

const numberFormats = new Map<string, Intl.NumberFormat>();

export function formatNumber(value: number, intlLocale: string): string {
  let format = numberFormats.get(intlLocale);
  if (!format) {
    format = new Intl.NumberFormat(intlLocale);
    numberFormats.set(intlLocale, format);
  }
  return format.format(value);
}

export function formatPercent(value: number, intlLocale: string): string {
  return new Intl.NumberFormat(intlLocale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact age for dense columns: "now", "12m", "5h", "3d", "6w", "4mo", "2y" (localized units). */
export function formatAge(
  date: Date,
  now: Date,
  units: UIStrings["ageUnits"],
): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  const join = (value: number, unit: string) =>
    `${value}${units.separator}${unit}`;
  if (elapsed < MINUTE) return units.now;
  if (elapsed < HOUR) return join(Math.floor(elapsed / MINUTE), units.minute);
  if (elapsed < DAY) return join(Math.floor(elapsed / HOUR), units.hour);
  if (elapsed < 14 * DAY) return join(Math.floor(elapsed / DAY), units.day);
  if (elapsed < 60 * DAY)
    return join(Math.floor(elapsed / (7 * DAY)), units.week);
  if (elapsed < 365 * DAY)
    return join(Math.floor(elapsed / (30 * DAY)), units.month);
  return join(Math.floor(elapsed / (365 * DAY)), units.year);
}

export function formatDate(
  date: Date,
  intlLocale: string,
  withTime = false,
): string {
  return new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function formatShortDate(date: Date, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
  }).format(date);
}
