"use server";


import { pinata } from "@/lib/pinata";


export async function uploadImage(image: File) {
    try {
        const { cid } = await pinata.upload.public.file(image);
        const url = await pinata.gateways.public.convert(cid);
        return { success: true, url };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return { success: false, url: false };
    }
}