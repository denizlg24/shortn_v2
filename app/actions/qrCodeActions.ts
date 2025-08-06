'use server';

import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/auth/User';
import QRCodeV2, { IQRCode } from '@/models/url/QRCodeV2';
import UrlV3 from '@/models/url/UrlV3';
import { nanoid } from 'nanoid';
import QRCodeStyling, {
    Options,
} from "qr-code-styling";
import { JSDOM } from "jsdom";
import nodeCanvas from "canvas";
import { addDays } from 'date-fns';
import { ITag } from '@/models/url/Tag';
import { getTagById } from './tagActions';

/**
 * Generates a QR code as a base64 PNG using full customization options.
 * @param options - Full set of QRCodeStyling options
 * @returns Base64 PNG data URI string
 */
export async function generateQRCodeBase64(options: Partial<Options>): Promise<string> {
    const qrCode = new QRCodeStyling(options);

    const buffer = await qrCode.getRawData("png");
    if (!buffer) {
        return '';
    }
    return `data:image/png;base64,${buffer.toString("base64")}`;
}

interface CreateUrlInput {
    longUrl: string;
    title?: string;
    attachedUrl?: string;
    tags?: string[];
    options?: Partial<Options>
}

async function fetchPageTitle(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, { method: 'GET' });
        const html = await res.text();
        const match = html.match(/<title>(.*?)<\/title>/i);
        return match ? match[1].trim() : null;
    } catch {
        return null;
    }
}

function formatFallbackDate(): string {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export async function createQrCode({
    longUrl,
    title,
    attachedUrl,
    tags = [],
    options
}: CreateUrlInput) {
    try {
        await connectDB();

        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }

        const sub = user.sub;
        const urlCode = nanoid(6);
        const qrShortCode = nanoid(6);
        const shortUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${urlCode}`;

        let resolvedTitle = title?.trim();

        if (!resolvedTitle) {
            resolvedTitle = await fetchPageTitle(longUrl) || "";
        }

        if (!resolvedTitle) {
            try {
                const url = new URL(longUrl);
                resolvedTitle = `${url.hostname} - untitled`;
            } catch (e) {
                resolvedTitle = `QR Code created on ${formatFallbackDate()}`;
            }
        }

        const dbUser = await User.findOne({ sub: user.sub });
        if (!dbUser) {
            return {
                success: false,
                message: 'no-user',
            };
        }
        const links = dbUser.qr_codes_this_month;
        if (dbUser.plan.subscription === "free") {
            if (links >= 3) {
                return {
                    success: false,
                    message: 'plan-limit',
                };
            }
        }
        if (dbUser.plan.subscription === "basic") {
            if (links >= 25) {
                return {
                    success: false,
                    message: 'plan-limit',
                };
            }
        }
        if (dbUser.plan.subscription === "plus") {
            if (links >= 50) {
                return {
                    success: false,
                    message: 'plan-limit',
                };
            }
        }

        const newUrl = await UrlV3.create({
            sub,
            urlCode,
            longUrl,
            shortUrl,
            qrCodeId: qrShortCode,
            isQrCode: true,
            title: resolvedTitle,
        });

        const defaultOptions: Partial<Options> = {
            width: 300,
            height: 300,
            type: 'svg',
            jsdom: JSDOM,
            nodeCanvas,
            data: newUrl.shortUrl,
            dotsOptions: {
                color: "#1e90ff",
                type: "square",
            },
            backgroundOptions: {
                color: "#ffffff",
            },
            image: "",
            imageOptions: {
                crossOrigin: "anonymous",
                margin: 5,
            },
        }

        const finalOptions = options ? {
            ...options, data: newUrl.shortUrl, jsdom: JSDOM,
            nodeCanvas,
        } : defaultOptions;

        const base64 = await generateQRCodeBase64(finalOptions);

        const finalTags: ITag[] = [];

        if (tags) {
            for (const t of tags) {
                const tag = await getTagById(t, sub);
                if (tag) {
                    finalTags.push(tag);
                }
            }
        }

        const newQrCode = await QRCodeV2.create({
            sub,
            urlId: urlCode,
            attachedUrl,
            qrCodeId: qrShortCode,
            longUrl,
            title: resolvedTitle,
            tags: finalTags,
            qrCodeBase64: base64,
            options: finalOptions
        })

        const updatedUser = await User.findOneAndUpdate({ sub: user.sub }, { qr_codes_this_month: links + 1 });

        if (!updatedUser) {
            return {
                success: false,
                message: "server-error"
            }
        }

        return {
            success: true,
            data: {
                qrCodeId: newQrCode.qrCodeId,
                longUrl: newQrCode.longUrl,
                title: newQrCode.title,
            },
        };
    } catch (error) {
        console.log(error);
        return {
            success: false,
            message: "server-error"
        }
    }

}

interface IFilters {
    tags: string[];
    attachedQR: "all" | "on" | "off";
    sortBy: "date_asc" | "date_desc" | "clicks_asc" | "clicks_desc";
    query: string;
    page: number;
    limit: number;
    startDate?: Date;
    endDate?: Date;
}

export const getFilteredQRCodes = async (
    filters: IFilters,
    userSub: string
): Promise<{ qrcodes: IQRCode[]; total: number }> => {
    await connectDB();

    const pipeline: any[] = [];

    const matchStage: any = {
        sub: userSub,
    };

    if (filters.startDate || filters.endDate) {
        matchStage.date = {};
        if (filters.startDate) {
            matchStage.date.$gte = filters.startDate;
        }
        if (filters.endDate) {
            matchStage.date.$lte = addDays(filters.endDate, 1);
        }
    }

    if (filters.tags.length > 0) {
        matchStage.tags = { $elemMatch: { id: { $in: filters.tags } } };
    }

    if (filters.attachedQR === "on") {
        matchStage.attachedUrl = {
            $exists: true,
            $ne: null,
            $not: { $eq: "" }
        };
    } else if (filters.attachedQR === "off") {
        matchStage.attachedUrl = { $in: [null, undefined, ""] };
    }

    if (filters.query.trim()) {
        pipeline.push({
            $search: {
                index: "qr-code-text-search",
                text: {
                    query: filters.query.trim(),
                    path: ["title", "longUrl", "tags.tagName"],
                }
            }
        });
    }

    pipeline.push({ $match: matchStage });

    let sortStage: Record<string, 1 | -1> = {};
    switch (filters.sortBy) {
        case "date_asc":
            sortStage = { date: 1 };
            break;
        case "date_desc":
            sortStage = { date: -1 };
            break;
        case "clicks_asc":
            sortStage = { "clicks.total": 1 };
            break;
        case "clicks_desc":
            sortStage = { "clicks.total": -1 };
            break;
    }
    pipeline.push({ $sort: sortStage });

    const skip = (filters.page - 1) * filters.limit;
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: filters.limit });

    const countPipeline = [...pipeline.filter(stage => !("$skip" in stage || "$limit" in stage)), { $count: "total" }];

    const [qrcodes, totalResult] = await Promise.all([
        QRCodeV2.aggregate(pipeline).exec(),
        QRCodeV2.aggregate(countPipeline).exec()
    ]);

    const total = totalResult[0]?.total || 0;

    const qrcodesSanitized = qrcodes.map((qrcode) => ({
        ...qrcode,
        _id: qrcode._id.toString(),
        tags: qrcode.tags?.map((tag: ITag) => ({ ...tag, _id: (tag._id as any).toString() })),
    }));

    return { qrcodes: qrcodesSanitized, total };
};

export const getQRCode = async (sub: string, codeID: string) => {
    try {
        await connectDB();
        const qr = await QRCodeV2.findOne({ sub, qrCodeId: codeID }).lean();
        if (!qr) {
            return { success: false, url: undefined };
        }
        const filtered = { ...qr, _id: qr._id.toString(), tags: qr.tags?.map((tag) => ({ ...tag, _id: tag._id.toString() })) };
        return { success: true, qr: filtered };
    } catch (error) {
        return { success: false, qr: undefined };
    }
}

export const attachShortnToQR = async (urlCode: string, qrCodeId: string) => {
    try {
        await connectDB();
        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }

        const sub = user.sub;

        const updated = await QRCodeV2.findOneAndUpdate({ sub, qrCodeId }, { attachedUrl: urlCode });
        if (!updated) {
            return { success: false, message: 'error-updating' };
        }
        return { success: true };
    } catch (error) {
        return { success: false, message: 'server-error' }
    }
}

export const deleteQRCode = async (qrCodeId: string) => {
    try {
        await connectDB();
        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }

        const sub = user.sub;
        const foundQR = await QRCodeV2.findOneAndDelete({ qrCodeId, sub });
        if (!foundQR) {
            return { success: true, deleted: qrCodeId };
        }
        const foundRootURL = await UrlV3.findOneAndDelete({ sub, urlCode: foundQR.urlId, isQrCode: true });
        if (foundQR.attachedUrl) {
            const detachURL = await UrlV3.findOneAndUpdate({ sub, qrCodeId: foundQR.qrCodeId }, { qrCodeId: "" });
        }
        return { success: true, deleted: qrCodeId };
    } catch (error) {
        return { success: false, message: 'server-error' };
    }
}
