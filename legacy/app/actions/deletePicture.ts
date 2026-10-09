"use server";

import { getServerSession } from "@/lib/session";
import { deleteObject, keyFromAssetUrl } from "@/lib/storage";
import { isOwnedUploadKey } from "@/lib/storage-keys";

export async function deletePicture(oldPic: string) {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const key = keyFromAssetUrl(oldPic);
    // External/legacy images stay in place until the planned asset migration.
    if (!key) return { success: true, message: null };
    if (!user.sub || !isOwnedUploadKey(key, user.sub)) {
      return { success: false, message: "no-user" };
    }
    await deleteObject(key);
    return { success: true, message: null };
  } catch {
    return { success: false, message: "server-error" };
  }
}
