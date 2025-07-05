"use server";

import { connectDB } from "@/lib/mongodb";
import { updateUserField } from "./updateUserField";
import env from "@/utils/env";
import { deletePicture } from "./deletePicture";

export async function deleteProfilePicture(sub: string, oldPic: string) {

    try {
        await connectDB();
        const { success } = await updateUserField(sub, "profilePicture", "");
        if (success) {
            if (oldPic.startsWith(`https://${env.PINATA_GATEWAY}`)) {
                await deletePicture(oldPic);
            }
            return { success };
        }
        return { success: false, message: 'error-deleting' }
    } catch (e) {
        console.log(e);
        return { success: false, message: 'server-error' };
    }
}
