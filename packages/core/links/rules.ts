import { z } from "zod";
import { createHash } from "node:crypto";
import { UAParser } from "ua-parser-js";
import { validateDestination } from "../safety/structural";

const utm = z
  .object({
    source: z.string().trim().max(200).optional(),
    medium: z.string().trim().max(200).optional(),
    campaign: z.string().trim().max(200).optional(),
    term: z.string().trim().max(200).optional(),
    content: z.string().trim().max(200).optional(),
  })
  .strict();
const safeUrl = z
  .httpUrl()
  .max(2048)
  .refine((url) => validateDestination(url).ok, "Unsafe destination");
// Explicit app schemes keep script, file, intent and OS command handlers out.
const appSchemes = new Set([
  "youtube:",
  "spotify:",
  "whatsapp:",
  "tg:",
  "instagram:",
  "fb:",
  "twitter:",
  "linkedin:",
  "slack:",
  "discord:",
  "zoomus:",
]);
const appUrl = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => {
    if (
      [...value].some(
        (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
      )
    )
      return false;
    try {
      const url = new URL(value);
      return (
        !url.username &&
        !url.password &&
        (url.protocol === "https:"
          ? validateDestination(value).ok
          : appSchemes.has(url.protocol))
      );
    } catch {
      return false;
    }
  }, "Use a public HTTPS app link or a supported app scheme");
const deepLinkRule = z
  .object({
    ios: appUrl.optional(),
    android: appUrl.optional(),
    fallback: z.enum(["web", "store"]),
    store: z
      .object({
        ios: safeUrl
          .refine(
            (value) =>
              validateDestination(value).ok &&
              new URL(value).protocol === "https:" &&
              new URL(value).hostname === "apps.apple.com",
            "Use an Apple App Store URL",
          )
          .optional(),
        android: safeUrl
          .refine(
            (value) =>
              validateDestination(value).ok &&
              new URL(value).protocol === "https:" &&
              new URL(value).hostname === "play.google.com",
            "Use a Google Play URL",
          )
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (rule) => Boolean(rule.ios || rule.android),
    "Choose at least one app link",
  )
  .refine(
    (rule) =>
      rule.fallback !== "store" ||
      ((!rule.ios || rule.store?.ios) &&
        (!rule.android || rule.store?.android)),
    "Provide a store URL for each configured OS",
  );
const countryTarget = z
  .object({ country: z.string().regex(/^[A-Z]{2}$/), url: safeUrl })
  .strict();
const deviceTarget = z
  .object({
    os: z.enum(["ios", "android", "windows", "macos"]).optional(),
    device: z.enum(["mobile", "tablet", "desktop"]).optional(),
    url: safeUrl,
  })
  .strict()
  .refine((rule) => Boolean(rule.os || rule.device), "Choose an OS or device");
const ruleFields = {
  deepLink: deepLinkRule.optional(),
  maxClicks: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .describe(
      "Approximate lifetime non-bot destination visit limit, including scans. Concurrent and queued visits may overshoot.",
    )
    .optional(),
  rotation: z
    .array(
      z
        .object({ url: safeUrl, weight: z.number().positive().max(1_000_000) })
        .strict(),
    )
    .min(1)
    .max(10)
    .optional(),
  geo: z.array(countryTarget).max(10).optional(),
  device: z.array(deviceTarget).max(10).optional(),
  expiredUrl: safeUrl.optional(),
  forwardQuery: z.boolean().optional(),
  utm: utm.optional(),
  permanent: z.boolean().optional(),
};
export const linkRulesInputSchema = z
  .object({
    activeFrom: z.iso.datetime().optional(),
    expiresAt: z.iso.datetime().optional(),
    ...ruleFields,
  })
  .strict()
  .refine(
    (rules) =>
      !rules.activeFrom ||
      !rules.expiresAt ||
      Date.parse(rules.activeFrom) < Date.parse(rules.expiresAt),
    "Activation must precede expiry",
  );
export type LinkRulesInput = z.infer<typeof linkRulesInputSchema>;
export const compiledRulesSchema = z.object({
  rotationKey: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  activeFrom: z.number().finite().optional(),
  expiresAt: z.number().finite().optional(),
  ...ruleFields,
});
export type CompiledRules = z.infer<typeof compiledRulesSchema>;

export function storedRules(input: LinkRulesInput) {
  // Mongo encodes undefined as null by default. Omit optional values at every
  // depth so a typed caller cannot persist rules that fail their next cache fill.
  const clean = JSON.parse(JSON.stringify(input)) as LinkRulesInput;
  const { activeFrom, expiresAt, ...rest } = clean;
  return {
    ...rest,
    ...(activeFrom ? { activeFrom: new Date(activeFrom) } : {}),
    ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
  };
}

/** Compile dates once on cache fill; retain compatibility with the prototype startsAt field. */
export function compileRules(value: unknown): CompiledRules | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const from = raw.activeFrom ?? raw.startsAt;
  const rotation =
    Array.isArray(raw.rotation) && raw.rotation.length > 0
      ? raw.rotation.map((target: Record<string, unknown>) => ({
          url: target.url ?? target.destination,
          weight: target.weight,
        }))
      : undefined;

  const rules = compiledRulesSchema.parse({
    ...(from !== undefined
      ? { activeFrom: new Date(from as string | Date).getTime() }
      : {}),
    ...(raw.expiresAt !== undefined
      ? { expiresAt: new Date(raw.expiresAt as string | Date).getTime() }
      : {}),
    deepLink: raw.deepLink,
    maxClicks: raw.maxClicks,
    rotation,
    ...(rotation ? { rotationKey: rotationFingerprint(rotation) } : {}),
    geo: Array.isArray(raw.geo)
      ? raw.geo.flatMap((target: Record<string, unknown>) =>
          target.country !== undefined
            ? [target]
            : Array.isArray(target.countries)
              ? target.countries.map((country) => ({
                  country,
                  url: target.destination,
                }))
              : [],
        )
      : undefined,
    device:
      raw.device ??
      (Array.isArray(raw.devices)
        ? raw.devices.map((target: Record<string, unknown>) => ({
            device: target.device,
            url: target.destination,
          }))
        : undefined),
    expiredUrl: raw.expiredUrl,
    forwardQuery: raw.forwardQuery,
    utm: raw.utm,
    permanent: raw.permanent,
  });
  return Object.values(rules).some((value) => value !== undefined)
    ? rules
    : undefined;
}
export function rulesView(value: unknown): LinkRulesInput | undefined {
  const compiled = compileRules(value);
  if (!compiled) return undefined;
  const {
    activeFrom,
    expiresAt,
    rotationKey: _rotationKey,
    ...rest
  } = compiled;
  void _rotationKey;
  return {
    ...rest,
    ...(activeFrom !== undefined
      ? { activeFrom: new Date(activeFrom).toISOString() }
      : {}),
    ...(expiresAt !== undefined
      ? { expiresAt: new Date(expiresAt).toISOString() }
      : {}),
  };
}

/** Existing destination parameters win over incoming values; fixed UTM wins over both. */
export function applyQueryRules(
  destination: string,
  rules: CompiledRules | undefined,
  incoming?: URLSearchParams,
): string {
  const target = new URL(destination);
  if (rules?.forwardQuery && incoming) {
    const existing = new Set(target.searchParams.keys());
    let count = 0;
    for (const [key, value] of incoming) {
      if (count >= 50) break;
      if (["token", "q", "ref", "block"].includes(key) || existing.has(key))
        continue;
      const name = key.slice(0, 100),
        text = value.slice(0, 500);
      // Avoid query truncation turning a different key into a reserved name.
      if (["token", "q", "ref", "block"].includes(name)) continue;
      target.searchParams.append(name, text);
      count++;
    }
  }
  for (const [field, value] of Object.entries(rules?.utm ?? {})) {
    if (value) target.searchParams.set(`utm_${field}`, value);
  }
  return target.toString();
}

export function ruleDestinations(value: unknown): string[] {
  const rules = compileRules(value);
  return [
    ...new Set([
      ...(rules?.expiredUrl ? [rules.expiredUrl] : []),
      ...[rules?.deepLink?.ios, rules?.deepLink?.android].filter(
        (url): url is string =>
          Boolean(url && new URL(url).protocol === "https:"),
      ),
      ...Object.values(rules?.deepLink?.store ?? {}).filter(
        (url): url is string => Boolean(url),
      ),
      ...(rules?.device ?? []).map((rule) => rule.url),
      ...(rules?.geo ?? []).map((rule) => rule.url),
      ...(rules?.rotation ?? []).map((rule) => rule.url),
    ]),
  ].sort();
}

export function chooseRuleTarget(
  destination: string,
  rules: CompiledRules | undefined,
  input: {
    bot?: boolean | undefined;
    country?: string | undefined;
    userAgent?: string | undefined;
    rotationCookie?: string | undefined;
    rotationRandom?: (() => number) | undefined;
  },
) {
  if (rules?.device?.length || rules?.deepLink) {
    const ua = new UAParser((input.userAgent ?? "").slice(0, 2000)).getResult();
    const name = ua.os.name?.toLowerCase();
    const os =
      name === "ios"
        ? "ios"
        : name === "android"
          ? "android"
          : name?.startsWith("windows")
            ? "windows"
            : name === "mac os" || name === "macos"
              ? "macos"
              : undefined;
    if (
      !input.bot &&
      (os === "ios" || os === "android") &&
      rules?.deepLink?.[os]
    )
      return {
        destination: rules.deepLink[os]!,
        branch: `deep:${os}`,
        deepFallback:
          rules.deepLink.fallback === "store"
            ? rules.deepLink.store![os]!
            : destination,
      };
    const device = ua.device.type ?? "desktop";
    const index =
      rules.device?.findIndex(
        (rule) =>
          (!rule.os || rule.os === os) &&
          (!rule.device || rule.device === device),
      ) ?? -1;
    if (index >= 0)
      return {
        destination: rules.device![index]!.url,
        branch: `device:${index}`,
      };
  }
  const index =
    rules?.geo?.findIndex(
      (rule) => rule.country === input.country?.toUpperCase(),
    ) ?? -1;
  if (index >= 0)
    return { destination: rules!.geo![index]!.url, branch: `geo:${index}` };
  if (rules?.rotation?.length) {
    const fingerprint =
      rules.rotationKey ?? rotationFingerprint(rules.rotation);
    const match = /^([a-f0-9]{64})\.(\d{1,2})$/.exec(
      input.rotationCookie ?? "",
    );
    const previous = match && match[1] === fingerprint ? Number(match[2]) : -1;
    if (previous >= 0 && previous < rules.rotation.length)
      return {
        destination: rules.rotation[previous]!.url,
        branch: `rotation:${previous}`,
      };
    const random =
      input.rotationRandom?.() ??
      crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
    if (!Number.isFinite(random) || random < 0 || random >= 1)
      throw new Error("Rotation random must be in [0,1)");
    const total = rules.rotation.reduce(
      (sum, option) => sum + option.weight,
      0,
    );
    const pick = random * total;
    let cumulative = 0,
      selected = rules.rotation.length - 1;
    for (const [index, option] of rules.rotation.entries()) {
      cumulative += option.weight;
      if (pick < cumulative) {
        selected = index;
        break;
      }
    }
    return {
      destination: rules.rotation[selected]!.url,
      branch: `rotation:${selected}`,
      rotationCookie: `${fingerprint}.${selected}`,
    };
  }
  return {
    destination,
    ...(rules?.device?.length || rules?.geo?.length || rules?.deepLink
      ? { branch: "destination" }
      : {}),
  };
}

function rotationFingerprint(rotation: unknown): string {
  return createHash("sha256").update(JSON.stringify(rotation)).digest("hex");
}
export const rotationCookieName = (linkId: string) => `_sr_${linkId}`;
