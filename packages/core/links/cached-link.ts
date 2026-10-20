import { socialPreviewSchema, readSocialPreview } from "./og";
import { z } from "zod";
import { compiledRulesSchema, compileRules } from "./rules";

// The redirect hot path only needs this projection. During coexistence it is
// derived from the legacy fields, which stay authoritative until P4 (02 §3a.1).
export const cachedLinkSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("link"),
    id: z.string(),
    ws: z.string().optional(),
    key: z.string(),
    dest: z.string(),
    status: z.enum(["ok", "interstitial", "blocked"]),
    pwd: z.boolean(),
    hits: z.number().int().nonnegative().optional(),
    rules: compiledRulesSchema.optional(),
    og: socialPreviewSchema.optional(),
    // A QR-backed link counts its hits as scans of this QR code.
    qr: z.object({ id: z.string(), publicId: z.string() }).optional(),
    // Legacy flags the link as QR-backed but its QR document is gone: legacy
    // still redirects but records nothing.
    untracked: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("alias"), id: z.string(), key: z.string() }),
  z.object({ kind: z.literal("missing") }),
  z.object({ kind: z.literal("deleted") }),
]);
export type CachedLink = z.infer<typeof cachedLinkSchema>;

export const encodeCachedLink = (link: CachedLink) => JSON.stringify(link);
export const decodeCachedLink = (encoded: string) =>
  cachedLinkSchema.parse(JSON.parse(encoded));

export const cacheTtlSeconds = (link: CachedLink) =>
  link.kind === "missing" || link.kind === "deleted"
    ? 60
    : 3600 + Math.floor(Math.random() * 300);

export interface LegacyLinkFields {
  _id: { toHexString(): string };
  workspaceId?: { toHexString(): string } | undefined;
  urlCode?: string | undefined;
  key?: string | undefined;
  longUrl?: string | undefined;
  deletedAt?: Date | undefined;
  rules?: unknown;
  og?: unknown;
  title?: string | undefined;
  disabled?: boolean | undefined;
  safetyStatus?: string | undefined;
  requiresInterstitial?: boolean | undefined;
  passwordProtected?: boolean | undefined;
  clicks?: { total?: number | undefined } | undefined;
  stats?:
    { clicks?: number | undefined; scans?: number | undefined } | undefined;
  isQrCode?: boolean | undefined;
  qrCodeId?: string | undefined;
  demo?: boolean | undefined;
  moderation?: { state?: string | undefined } | undefined;
}

export interface LegacyQrFields {
  clicks?: { total?: number | undefined } | undefined;
  _id: { toHexString(): string };
  qrCodeId?: string | undefined;
}

export const linkProjection = {
  _id: 1,
  workspaceId: 1,
  urlCode: 1,
  key: 1,
  longUrl: 1,
  deletedAt: 1,
  rules: 1,
  og: 1,
  title: 1,
  "clicks.total": 1,
  "stats.clicks": 1,
  "stats.scans": 1,
  disabled: 1,
  safetyStatus: 1,
  requiresInterstitial: 1,
  passwordProtected: 1,
  isQrCode: 1,
  qrCodeId: 1,
  demo: 1,
  "moderation.state": 1,
} as const;

export function isLegacyQrBacked(link: LegacyLinkFields): boolean {
  return Boolean(link.isQrCode && link.qrCodeId);
}

export function toCachedLink(
  link: LegacyLinkFields,
  requestedKey: string,
  qr: LegacyQrFields | null,
): CachedLink {
  if (link.deletedAt) return { kind: "deleted" };
  // A takedown also sets the legacy fields; this keeps it blocked if those
  // are ever cleared by a writer that doesn't know about moderation.
  const blocked =
    link.disabled ||
    link.safetyStatus === "blocked" ||
    link.safetyStatus === "malicious" ||
    link.moderation?.state === "taken_down";
  const interstitial =
    link.requiresInterstitial || link.safetyStatus === "suspicious";
  const qrBacked = isLegacyQrBacked(link);
  const rules = compileRules(link.rules);
  const og = readSocialPreview(link.og);
  return {
    kind: "link",
    id: link._id.toHexString(),
    ...(link.workspaceId ? { ws: link.workspaceId.toHexString() } : {}),
    key: requestedKey,
    dest: link.longUrl ?? "",
    status: blocked ? "blocked" : interstitial ? "interstitial" : "ok",
    pwd: Boolean(link.passwordProtected),
    ...(rules ? { rules } : {}),
    ...(og
      ? {
          og: {
            ...og,
            title:
              og.title ?? (link.title?.trim().slice(0, 200) || requestedKey),
          },
        }
      : {}),
    ...(rules?.maxClicks !== undefined
      ? {
          hits: Math.max(
            link.clicks?.total ?? 0,
            (link.stats?.clicks ?? 0) + (link.stats?.scans ?? 0),
            qr?.clicks?.total ?? 0,
          ),
        }
      : {}),
    ...(qrBacked && qr?.qrCodeId
      ? { qr: { id: qr._id.toHexString(), publicId: qr.qrCodeId } }
      : {}),
    // Demo links are counted for their click cap but never enter analytics.
    ...((qrBacked && !qr?.qrCodeId) || link.demo ? { untracked: true } : {}),
  };
}
