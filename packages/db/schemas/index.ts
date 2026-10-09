import { ObjectId } from "mongodb";
import { z } from "zod";
export const objectId = z.instanceof(ObjectId);
const text = z.string();
const count = z.number().int().nonnegative();
const utm = z.object({
  source: text.optional(),
  medium: text.optional(),
  campaign: text.optional(),
  term: text.optional(),
  content: text.optional(),
});
const sync = z.object({
  rev: count,
  lastWriter: z.enum(["legacy", "v2"]),
  legacyHash: text,
});
const base = {
  _id: objectId,
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  _sync: sync.optional(),
};
const legacy = {
  sub: text.optional(),
  date: z.date().optional(),
  urlCode: text.optional(),
  longUrl: z.httpUrl().optional(),
  title: text.optional(),
  tags: z
    .array(
      z.looseObject({
        _id: objectId.optional(),
        id: text.optional(),
        sub: text.optional(),
        tagName: text.optional(),
        name: text.optional(),
        color: text.optional(),
      }),
    )
    .optional(),
  clicks: z
    .object({
      total: count.optional(),
      lastClick: z.date().nullable().optional(),
    })
    .optional(),
};
const rules = z.object({
  expiresAt: z.date().optional(),
  startsAt: z.date().optional(),
  maxClicks: count.optional(),
  geo: z
    .array(z.object({ countries: z.array(text), destination: z.httpUrl() }))
    .optional(),
  devices: z
    .array(z.object({ device: text, destination: z.httpUrl() }))
    .optional(),
  rotation: z
    .array(
      z.object({ destination: z.httpUrl(), weight: z.number().positive() }),
    )
    .optional(),
  deepLinks: z.record(text, z.httpUrl()).optional(),
});
export const linkSchema = z.looseObject({
  ...base,
  ...legacy,
  workspaceId: objectId.optional(),
  domain: text.optional(),
  key: text.optional(),
  destination: z.httpUrl().optional(),
  description: text.optional(),
  tagIds: z.array(objectId).optional(),
  campaignId: objectId.optional(),
  utm: utm.optional(),
  password: z.object({ hash: text, hint: text.optional() }).optional(),
  safety: z
    .object({
      status: text,
      riskScore: z.number(),
      flagged: z.boolean(),
      disabled: z.boolean(),
      disabledReason: text.optional(),
      reportCount: count,
      lastScannedAt: z.date().optional(),
      provider: text.optional(),
      interstitial: z.boolean(),
    })
    .optional(),
  rules: rules.optional(),
  og: z
    .object({
      title: text.optional(),
      description: text.optional(),
      image: z.httpUrl().optional(),
    })
    .optional(),
  qr: z.object({ legacyBacking: z.boolean() }).optional(),
  previousKeys: z.array(text).optional(),
  attachedQrId: objectId.optional(),
  stats: z
    .object({
      clicks: count,
      scans: count,
      lastClickAt: z.date().optional(),
      legacyTotal: count.optional(),
    })
    .optional(),
  createdBy: text.optional(),
  archivedAt: z.date().optional(),
  deletedAt: z.date().optional(),
  isQrCode: z.boolean().optional(),
  qrCodeId: text.optional(),
  passwordProtected: z.boolean().optional(),
  passwordHash: text.optional(),
  passwordHint: text.optional(),
  riskScore: z.number().optional(),
  safetyStatus: text.optional(),
  disabled: z.boolean().optional(),
  flagged: z.boolean().optional(),
  requiresInterstitial: z.boolean().optional(),
  utmLinks: z
    .array(
      z.looseObject({
        url: z.httpUrl().optional(),
        campaign: z
          .looseObject({ _id: objectId.optional(), title: text.optional() })
          .optional(),
      }),
    )
    .optional(),
});
export const qrCodeSchema = z.looseObject({
  ...base,
  ...legacy,
  workspaceId: objectId.optional(),
  linkId: objectId.optional(),
  publicId: text.optional(),
  tagIds: z.array(objectId).optional(),
  design: z.looseObject({ data: z.httpUrl().optional() }).optional(),
  stats: z.object({ scans: count, lastScanAt: z.date().optional() }).optional(),
  qrCodeId: text.optional(),
  urlId: text.optional(),
  options: z.looseObject({ data: z.httpUrl().optional() }).optional(),
});
export const workspaceSchema = z.object({
  ...base,
  slug: text.min(1),
  name: text.min(1),
  logo: z.httpUrl().optional(),
  ownerUserId: text,
  personal: z.boolean(),
  plan: z.enum(["free", "basic", "plus", "pro", "enterprise"]),
  addOns: z.array(text),
  defaultDomain: text,
  legacySub: text.optional(),
});
export const workspaceMemberSchema = z.object({
  ...base,
  workspaceId: objectId,
  userId: text,
  role: z.enum(["owner", "admin", "member", "viewer"]),
  invitedBy: text.optional(),
});
export const clickEventSchema = z.object({
  _id: objectId.optional(),
  ts: z.date(),
  m: z.object({
    workspaceId: objectId,
    linkId: objectId.nullable(),
    qrId: objectId.optional(),
    kind: z.enum(["click", "scan"]),
    domain: text,
    key: text,
    legacyCode: text.optional(),
  }),
  country: text.optional(),
  region: text.optional(),
  city: text.optional(),
  continent: text.optional(),
  tz: text.optional(),
  lang: text.optional(),
  browser: text.optional(),
  os: text.optional(),
  device: text.optional(),
  bot: z.literal(false),
  referrer: text.optional(),
  refDomain: text.optional(),
  utm: utm.optional(),
  ipHash: text,
  ipPrefix: text,
  uaHash: text,
  legacyId: objectId.optional(),
});
const breakdown = z.record(text, count);
export const clickRollupSchema = z.object({
  _id: objectId.optional(),
  linkId: objectId,
  workspaceId: objectId,
  day: z.date(),
  clicks: count,
  scans: count,
  byCountry: breakdown,
  byDevice: breakdown,
  byBrowser: breakdown,
  byOs: breakdown,
  byRefDomain: breakdown,
  byHour: z.array(count).length(24),
});
export const tagSchema = z.looseObject({
  ...base,
  sub: text.optional(),
  workspaceId: objectId.optional(),
  id: text.optional(),
  tagName: text.optional(),
  name: text.optional(),
  nameLower: text.optional(),
  color: text.optional(),
  legacyIds: z.array(text).optional(),
});
export const campaignSchema = z.looseObject({
  ...base,
  sub: text.optional(),
  workspaceId: objectId.optional(),
  title: text,
  description: text.optional(),
  utmDefaults: utm.optional(),
  links: z.array(objectId).optional(),
});
const block = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("link"),
    linkId: objectId,
    title: text.optional(),
    image: z.httpUrl().optional(),
  }),
  z.object({
    type: z.literal("profile"),
    title: text.optional(),
    avatar: z.httpUrl().optional(),
    description: text.optional(),
  }),
  z.object({
    type: z.literal("socials"),
    items: z.array(z.object({ platform: text, url: z.httpUrl() })),
  }),
  z.object({ type: z.literal("text"), text }),
  z.object({ type: z.literal("image"), url: z.httpUrl(), alt: text }),
]);
export const bioPageSchema = z.looseObject({
  ...base,
  workspaceId: objectId.optional(),
  handle: text.regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/).optional(),
  customDomain: text.optional(),
  title: text.optional(),
  description: text.optional(),
  avatar: z.httpUrl().optional(),
  theme: z.looseObject({ customFontFamily: text.optional() }).optional(),
  blocks: z.array(block).optional(),
  seo: z
    .object({
      title: text.optional(),
      description: text.optional(),
      image: z.httpUrl().optional(),
    })
    .optional(),
  published: z.boolean().optional(),
  legacySlug: text.optional(),
  slug: text.optional(),
  userId: text.optional(),
  links: z.array(z.looseObject({ link: objectId })).optional(),
  socials: z
    .array(
      z.looseObject({ platform: text.optional(), url: z.httpUrl().optional() }),
    )
    .optional(),
});
export const bioAliasSchema = z.object({
  ...base,
  slug: text,
  bioPageId: objectId,
});
export const domainSchema = z.object({
  ...base,
  workspaceId: objectId,
  hostname: text,
  kind: z.enum(["links", "bio", "both"]),
  cfCustomHostnameId: text.optional(),
  status: z.enum(["pending", "active", "failed", "disabled"]),
  verification: z.object({
    type: text,
    name: text.optional(),
    value: text.optional(),
    verifiedAt: z.date().optional(),
  }),
});
export const subscriptionSchema = z.object({
  ...base,
  workspaceId: objectId,
  polarSubscriptionId: text,
  polarCustomerId: text,
  productId: text,
  status: z.enum([
    "active",
    "trialing",
    "past_due",
    "canceled",
    "unpaid",
    "incomplete",
    "incomplete_expired",
  ]),
  plan: workspaceSchema.shape.plan,
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  cancelAtPeriodEnd: z.boolean(),
});
export const usagePeriodSchema = z.object({
  ...base,
  workspaceId: objectId,
  period: text.regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  links: count,
  qrCodes: count,
  bioPages: count,
});
export const apiKeySchema = z.object({
  ...base,
  workspaceId: objectId,
  name: text,
  hashedKey: text,
  prefix: text,
  scopes: z.array(text),
  createdBy: text,
  lastUsedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  revokedAt: z.date().optional(),
});
export const schemas = {
  links: linkSchema,
  qr_codes: qrCodeSchema,
  click_events: clickEventSchema,
  click_rollups: clickRollupSchema,
  workspaces: workspaceSchema,
  workspace_members: workspaceMemberSchema,
  tags: tagSchema,
  campaigns: campaignSchema,
  bio_pages: bioPageSchema,
  bio_aliases: bioAliasSchema,
  domains: domainSchema,
  subscriptions: subscriptionSchema,
  usage_periods: usagePeriodSchema,
  api_keys: apiKeySchema,
};
export type Documents = {
  [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]>;
};
export type Insert<K extends keyof Documents> = Omit<Documents[K], "_id"> & {
  _id?: ObjectId;
};
export type Update<K extends keyof Documents> = Partial<
  Omit<Documents[K], "_id">
>;
