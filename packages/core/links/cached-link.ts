import { z } from "zod";

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
    // A QR-backed link counts its hits as scans of this QR code.
    qr: z.object({ id: z.string(), publicId: z.string() }).optional(),
    // Legacy flags the link as QR-backed but its QR document is gone: legacy
    // still redirects but records nothing.
    untracked: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("alias"), id: z.string(), key: z.string() }),
  z.object({ kind: z.literal("missing") }),
]);
export type CachedLink = z.infer<typeof cachedLinkSchema>;

export const encodeCachedLink = (link: CachedLink) => JSON.stringify(link);
export const decodeCachedLink = (encoded: string) =>
  cachedLinkSchema.parse(JSON.parse(encoded));

export const cacheTtlSeconds = (link: CachedLink) =>
  link.kind === "missing" ? 60 : 3600 + Math.floor(Math.random() * 300);

export interface LegacyLinkFields {
  _id: { toHexString(): string };
  workspaceId?: { toHexString(): string } | undefined;
  urlCode?: string | undefined;
  key?: string | undefined;
  longUrl?: string | undefined;
  disabled?: boolean | undefined;
  safetyStatus?: string | undefined;
  requiresInterstitial?: boolean | undefined;
  passwordProtected?: boolean | undefined;
  isQrCode?: boolean | undefined;
  qrCodeId?: string | undefined;
}

export interface LegacyQrFields {
  _id: { toHexString(): string };
  qrCodeId?: string | undefined;
}

export const linkProjection = {
  _id: 1,
  workspaceId: 1,
  urlCode: 1,
  key: 1,
  longUrl: 1,
  disabled: 1,
  safetyStatus: 1,
  requiresInterstitial: 1,
  passwordProtected: 1,
  isQrCode: 1,
  qrCodeId: 1,
} as const;

export function isLegacyQrBacked(link: LegacyLinkFields): boolean {
  return Boolean(link.isQrCode && link.qrCodeId);
}

export function toCachedLink(
  link: LegacyLinkFields,
  requestedKey: string,
  qr: LegacyQrFields | null,
): CachedLink {
  const blocked =
    link.disabled ||
    link.safetyStatus === "blocked" ||
    link.safetyStatus === "malicious";
  const interstitial =
    link.requiresInterstitial || link.safetyStatus === "suspicious";
  const qrBacked = isLegacyQrBacked(link);
  return {
    kind: "link",
    id: link._id.toHexString(),
    ...(link.workspaceId ? { ws: link.workspaceId.toHexString() } : {}),
    key: requestedKey,
    dest: link.longUrl ?? "",
    status: blocked ? "blocked" : interstitial ? "interstitial" : "ok",
    pwd: Boolean(link.passwordProtected),
    ...(qrBacked && qr?.qrCodeId
      ? { qr: { id: qr._id.toHexString(), publicId: qr.qrCodeId } }
      : {}),
    ...(qrBacked && !qr?.qrCodeId ? { untracked: true } : {}),
  };
}
