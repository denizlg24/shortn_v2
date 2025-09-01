"use server";


import { auth } from "@/auth";
import { pinata } from "@/lib/pinata";

export async function deletePicture(oldPic: string) {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }
        const cid = oldPic.split("/ipfs/")[1];
        const files = await pinata.files.public
            .list()
            .cid(cid);
        if (files && files.files && files.files.length > 0) {
            const file = files.files[0];
            await pinata.files.public.delete([
                file.id
            ])
        }
        return { success: true, message: null };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return { success: false, message: "server-error" };
    }
}