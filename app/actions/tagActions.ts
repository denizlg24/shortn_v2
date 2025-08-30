"use server";


import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import QRCodeV2 from "@/models/url/QRCodeV2";
import Tag from "@/models/url/Tag";
import UrlV3 from "@/models/url/UrlV3";
import { nanoid } from 'nanoid';

export async function createAndAddTagToUrl(tagName: string, urlCode: string) {
    const session = await auth();
    const user = session?.user;

    if (!user) {
        return {
            success: false,
            message: 'no-user',
        };
    }
    const sub = user?.sub;

    await connectDB();

    let tag = await Tag.findOne({ tagName, sub });

    if (!tag) {
        tag = await Tag.create({
            tagName,
            sub,
            id: nanoid(6),
        });
    }
    if (!tag) {
        return { success: false, message: 'server-error' };
    }
    const url = await UrlV3.findOne({ urlCode, sub });
    if (!url) return { success: false, message: "no-link" };

    const exists = url.tags?.some(t => t.tagName === tag?.tagName);
    if (!exists) {
        await UrlV3.findOneAndUpdate({ urlCode, sub }, { $push: { tags: tag } });
        const tagDocument = { tagName: tag.tagName, id: tag.id, sub: tag.sub, _id: (tag._id as any).toString() };
        return { success: true, tag: tagDocument };
    }
    return { success: false, message: "duplicate" }
}

export async function createAndAddTagToQRCode(tagName: string, qrCodeId: string) {
    const session = await auth();
    const user = session?.user;

    if (!user) {
        return {
            success: false,
            message: 'no-user',
        };
    }
    const sub = user?.sub;

    await connectDB();

    let tag = await Tag.findOne({ tagName, sub });

    if (!tag) {
        tag = await Tag.create({
            tagName,
            sub,
            id: nanoid(6),
        });
    }

    if (!tag) {
        return { success: false, message: 'server-error' };
    }

    const qrCode = await QRCodeV2.findOne({ qrCodeId, sub });
    if (!qrCode) return { success: false, message: "no-link" };

    const exists = qrCode.tags?.some(t => t.tagName === tag?.tagName);
    if (!exists) {
        await QRCodeV2.findOneAndUpdate({ qrCodeId, sub }, { $push: { tags: tag } });
        const tagDocument = { tagName: tag.tagName, id: tag.id, sub: tag.sub, _id: (tag._id as any).toString() };
        return { success: true, tag: tagDocument };
    }
    return { success: false, message: "duplicate" }
}

export async function addTagToLink(
    urlCode: string,
    tagId: string
) {
    const session = await auth();
    const user = session?.user;

    if (!user) {
        return {
            success: false,
            message: 'no-user',
        };
    }
    const sub = user?.sub;
    const tag = await Tag.findOne({ sub, id: tagId })
    await UrlV3.findOneAndUpdate({ urlCode, sub }, { $push: { tags: tag } });
    return { success: true };
}

export async function addTagToQRCode(
    qrCodeId: string,
    tagId: string
) {
    const session = await auth();
    const user = session?.user;

    if (!user) {
        return {
            success: false,
            message: 'no-user',
        };
    }
    const sub = user?.sub;
    const tag = await Tag.findOne({ sub, id: tagId })
    await QRCodeV2.findOneAndUpdate({ qrCodeId, sub }, { $push: { tags: tag } });
    return { success: true };
}

export async function removeTagFromLink(
    urlCode: string,
    tagId: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }
        const sub = user?.sub;
        await connectDB();
        const updated = await UrlV3.findOneAndUpdate(
            { urlCode, sub },
            { $pull: { tags: { id: tagId } } },
            { new: true }
        );

        if (!updated) {
            return { success: false, message: 'link-not-found' };
        }

        return { success: true };
    } catch (err) {
        return { success: false, message: 'server-error' };
    }
}

export async function removeTagFromQRCode(
    qrCodeId: string,
    tagId: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }
        const sub = user?.sub;
        await connectDB();
        const updated = await QRCodeV2.findOneAndUpdate(
            { qrCodeId, sub },
            { $pull: { tags: { id: tagId } } },
            { new: true }
        );

        if (!updated) {
            return { success: false, message: 'link-not-found' };
        }

        return { success: true };
    } catch (err) {
        return { success: false, message: 'server-error' };
    }
}

export async function createTag(tagName: string) {
    const session = await auth();
    const user = session?.user;

    if (!user) {
        return {
            success: false,
            message: 'no-user',
        };
    }
    const sub = user?.sub;

    await connectDB();

    let tag = await Tag.findOne({ tagName, sub });

    if (!tag) {
        const newId = nanoid(6);
        const newTag = await Tag.create({
            tagName,
            sub,
            id: newId,
        });
        if (newTag) {
            return { success: true, tag: { sub, tagName, id: newId, _id: (newTag._id as any).toString() } }
        }
        return { success: false, message: 'server-error' };
    }

    return { success: false, message: "duplicate" };
}

