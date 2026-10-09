import { z } from "zod";

// One stream entry per redirect. Raw request data stays here only until the
// worker enriches it; the stream is trimmed once entries are acknowledged.
export const clickMessageSchema = z.object({
  v: z.literal(1),
  ts: z.number().int().positive(),
  linkId: z.string().regex(/^[0-9a-f]{24}$/),
  qrId: z
    .string()
    .regex(/^[0-9a-f]{24}$/)
    .optional(),
  qrPublicId: z.string().optional(),
  domain: z.string(),
  key: z.string(),
  bot: z.boolean(),
  ip: z.string().max(45).optional(),
  ua: z.string().max(2000).optional(),
  referrer: z.string().max(4000).optional(),
  lang: z.string().max(100).optional(),
  country: z.string().max(8).optional(),
  regionCode: z.string().max(100).optional(),
  region: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  continent: z.string().max(8).optional(),
  tz: z.string().max(100).optional(),
  query: z.record(z.string(), z.string()).optional(),
  requestId: z.string().max(100).optional(),
});
export type ClickMessage = z.infer<typeof clickMessageSchema>;

export function encodeClickMessage(message: ClickMessage): string[] {
  return ["d", JSON.stringify(message)];
}

export function decodeClickMessage(fields: string[]): ClickMessage {
  const index = fields.indexOf("d");
  const payload = index >= 0 ? fields[index + 1] : undefined;
  if (payload === undefined) throw new Error("Click message without payload");
  return clickMessageSchema.parse(JSON.parse(payload));
}

// Same bounds as legacy sanitizeClickData.
export function boundedQuery(params: URLSearchParams): Record<string, string> {
  const entries: [string, string][] = [];
  for (const [key, value] of params) {
    if (entries.length >= 50) break;
    entries.push([key.slice(0, 100), value.slice(0, 500)]);
  }
  return Object.fromEntries(entries);
}

export interface HeaderReader {
  get(name: string): string | null | undefined;
}

function first(headers: HeaderReader, ...names: string[]) {
  for (const name of names) {
    const value = headers.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function decodeLocation(value: string | undefined) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeIp(value: string | undefined) {
  if (
    !value ||
    value.length > 45 ||
    (!value.includes(".") && !value.includes(":")) ||
    !/^[0-9a-f:.]+$/i.test(value)
  )
    return undefined;
  return value;
}

const cut = (value: string | undefined, length: number) =>
  value ? value.slice(0, length) : undefined;

type RequestField =
  | "ip"
  | "ua"
  | "referrer"
  | "lang"
  | "country"
  | "regionCode"
  | "region"
  | "city"
  | "continent"
  | "tz"
  | "requestId";

// Cloudflare is the only ingress (tunnel → Caddy), so its headers are trusted.
export function requestClickFields(
  headers: HeaderReader,
): Partial<Record<RequestField, string>> {
  const entries: [RequestField, string | undefined][] = [
    [
      "ip",
      normalizeIp(first(headers, "cf-connecting-ipv6", "cf-connecting-ip")),
    ],
    ["ua", cut(first(headers, "user-agent"), 2000)],
    ["referrer", cut(first(headers, "referer"), 4000)],
    ["lang", cut(first(headers, "accept-language")?.split(",")[0], 100)],
    ["country", cut(first(headers, "cf-ipcountry")?.toUpperCase(), 8)],
    [
      "regionCode",
      cut(decodeLocation(first(headers, "cf-region-code", "cf-region")), 100),
    ],
    ["region", cut(decodeLocation(first(headers, "cf-region")), 200)],
    ["city", cut(decodeLocation(first(headers, "cf-ipcity")), 200)],
    ["continent", cut(first(headers, "cf-ipcontinent"), 8)],
    ["tz", cut(first(headers, "cf-timezone"), 100)],
    ["requestId", cut(first(headers, "x-request-id", "cf-ray"), 100)],
  ];
  const fields: Partial<Record<RequestField, string>> = {};
  for (const [name, value] of entries) if (value) fields[name] = value;
  return fields;
}
