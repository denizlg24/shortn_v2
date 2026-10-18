import type { Locale } from "./messages";

const intlLocale: Record<Locale, string> = {
  en: "en-GB",
  pt: "pt-PT",
  es: "es-ES",
};

/**
 * Polar amounts are in the currency's minor unit, so the divisor comes from
 * the currency itself: 100 for EUR, 1 for JPY, 1000 for KWD.
 */
export function formatMoney(minor: number, currency: string, locale: Locale) {
  const format = new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(minor / 10 ** digits);
}

// Polar periods are UTC instants; formatting in UTC keeps 1 November from
// showing as 31 October on a server west of Greenwich.
const dates = (locale: Locale) =>
  new Intl.DateTimeFormat(intlLocale[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export const formatDate = (date: Date, locale: Locale) =>
  dates(locale).format(date);

export const formatDateRange = (start: Date, end: Date, locale: Locale) =>
  dates(locale).formatRange(start, end);

const cardBrands: Record<string, string> = {
  amex: "American Express",
  american_express: "American Express",
  cartes_bancaires: "Cartes Bancaires",
  diners: "Diners Club",
  discover: "Discover",
  eftpos_au: "eftpos",
  jcb: "JCB",
  mastercard: "Mastercard",
  unionpay: "UnionPay",
  visa: "Visa",
};

export interface Card {
  brand: string;
  last4: string;
}

/** "Visa •••• 4242"; `fallback` names the card when Polar gives no brand. */
export function formatCard(card: Card, fallback: string) {
  const key = card.brand.trim().toLowerCase();
  const brand =
    cardBrands[key] ??
    (key
      ? key.replace(/[_-]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase())
      : fallback);
  return `${brand} •••• ${card.last4.replace(/\D/g, "").slice(-4)}`;
}

/** Provider text shown to a customer: one short line, no control characters. */
export function plainLine(value: string | null | undefined, max = 140) {
  const clean = value
    ?.replace(/[\p{Cc}<>]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
