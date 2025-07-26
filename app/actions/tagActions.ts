"use server";

import { connectDB } from "@/lib/mongodb";
import Tag from "@/models/url/Tag";
import UrlV3 from "@/models/url/UrlV3";
import { nanoid } from 'nanoid';

export async function getTagsByQuery(query: string, sub: string) {
    if (!sub) return [];

    await connectDB();

    const tags = await Tag.find({
        sub,
        $text: { $search: query }
    }).limit(10).lean();

    const lean = tags.map((tag) => ({ ...tag, _id: tag._id.toString() }));

    return lean;
}

export async function getTags(sub: string) {
    if (!sub) return [];

    await connectDB();

    const tags = await Tag.find({
        sub,
    }).limit(10).lean();

    const lean = tags.map((tag) => ({ ...tag, _id: tag._id.toString() }));

    return lean;
}

export async function createAndAddTagToUrl(tagName: string, sub: string, urlCode: string) {
    if (!sub) return { success: false, message: "no-user" }

    await connectDB();

    let tag = await Tag.findOne({ tagName, sub });

    if (!tag) {
        tag = await Tag.create({
            tagName,
            sub,
            id: nanoid(6),
        });
    }

    const url = await UrlV3.findOne({ urlCode, sub });
    if (!url) return { success: false, message: "no-link" };

    const exists = url.tags?.some(t => t.tagName === tag.tagName);
    if (!exists) {
        await UrlV3.findOneAndUpdate({ urlCode, sub }, { $push: { tags: tag } });
        const tagDocument = { tagName: tag.tagName, id: tag.id, sub: tag.sub, _id: (tag._id as any).toString() };
        return { success: true, tag: tagDocument };
    }
    return { success: false, message: "duplicate" }
}

export async function addTagToLink(
    urlCode: string,
    userSub: string,
    tagId: string
) {
    const tag = await Tag.findOne({ sub: userSub, id: tagId })
    await UrlV3.findOneAndUpdate({ urlCode, sub: userSub }, { $push: { tags: tag } });
    return { success: true };
}


export async function removeTagFromLink(
    urlCode: string,
    userSub: string,
    tagId: string
): Promise<{ success: boolean; message?: string }> {
    try {

        await connectDB();
        const updated = await UrlV3.findOneAndUpdate(
            { urlCode, sub: userSub },
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
