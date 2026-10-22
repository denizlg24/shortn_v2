import { can, type Actor } from "@shortn/core";
import sharp from "sharp";

export const maxImageBytes = 5 * 1024 * 1024;

export const uploadPurposes = ["qr-logo", "bio-image", "avatar"] as const;
export type UploadPurpose = (typeof uploadPurposes)[number];

/** Uploads write to workspace storage, so a locked or suspended workspace
 * takes none. An avatar is the account's own identity: no staff
 * impersonation may change it. Other images follow resource edits. */
export function uploadAllowed(actor: Actor, purpose: UploadPurpose) {
  if (actor.readOnly) return false;
  if (purpose === "avatar") return !actor.impersonation;
  return can(actor, "resource.update");
}

// Decode actual image bytes, strip metadata, and rasterize SVG so uploaded
// documents can never execute as active content on the app origin.
export async function imageForStorage(bytes: Uint8Array) {
  if (bytes.length === 0 || bytes.length > maxImageBytes)
    throw new Error("size");
  const text = Buffer.from(bytes).toString("utf8");
  if (/<svg\b/i.test(text)) {
    if (/<!DOCTYPE|<!ENTITY|<foreignObject|<script|@import|\\/i.test(text))
      throw new Error("type");
    const resources = [
      ...text.matchAll(/(?:href\s*=\s*["']([^"']*)["']|url\s*\(([^)]*)\))/gi),
    ];
    for (const match of resources) {
      const value = (match[1] ?? match[2] ?? "")
        .trim()
        .replace(/^["']|["']$/g, "");
      if (
        !value.startsWith("#") &&
        !/^data:image\/(png|jpeg|webp);base64,/i.test(value)
      )
        throw new Error("type");
    }
  }
  const image = sharp(bytes, {
    limitInputPixels: 40_000_000,
    failOn: "warning",
  });
  const metadata = await image.metadata();
  if (!["png", "jpeg", "webp", "gif", "svg"].includes(metadata.format))
    throw new Error("type");
  return image
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

export async function boundedUploadBody(request: Request) {
  const limit = maxImageBytes + 64 * 1024;
  const length = Number(request.headers.get("content-length"));
  if (length > limit || !request.body) throw new Error("size");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        throw new Error("size");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "content-type": request.headers.get("content-type") ?? "" },
  }).formData();
}
