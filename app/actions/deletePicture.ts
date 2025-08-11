"use server";


import { pinata } from "@/lib/pinata";

export async function deletePicture(oldPic: string) {
    try {
        const cid = oldPic.split("/ipfs/")[1];
        const files = await pinata.files.public
            .list()
            .cid(cid);
        if (files && files.files && files.files.length > 0) {
            const file = files.files[0];
            const deletedFiles = await pinata.files.public.delete([
                file.id
            ])
        }
        return { success: true, message: null };
    } catch (error) {
        return { success: false, message: "server-error" };
    }
}