"use server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "@/lib/session";
import { assetUrl, putObject } from "@/lib/storage";
import { detectImageType, MAX_IMAGE_BYTES } from "@/lib/image-type";

export async function uploadImage(image: File) {
  try {
    const session = await getServerSession();
    if (
      !session?.user.sub ||
      !(image instanceof File) ||
      image.size > MAX_IMAGE_BYTES
    ) {
      return { success: false, url: false };
    }
    const bytes = new Uint8Array(await image.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return { success: false, url: false };

    const key = `uploads/${session.user.sub}/${randomUUID()}.${type.ext}`;
    const url = assetUrl(key);
    await putObject(key, bytes, type.contentType);
    return { success: true, url };
  } catch {
    return { success: false, url: false };
  }
}
