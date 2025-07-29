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
            tags,
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

        const base64 = await generateQRCodeBase64(defaultOptions);

        const newQrCode = await QRCodeV2.create({
            sub,
            urlId: urlCode,
            attachedUrl,
            qrCodeId: qrShortCode,
            longUrl,
            title: resolvedTitle,
            tags,
            qrCodeBase64: base64,
            options: defaultOptions
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
                tags: newQrCode.tags,
            },
        };
    } catch (error) {
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

    const query: any = {
        sub: userSub,
    };

    if (filters.startDate || filters.endDate) {
        query.date = {};
        if (filters.startDate) {
            query.date.$gte = filters.startDate;
        }
        if (filters.endDate) {
            query.date.$lte = addDays(filters.endDate, 1);
        }
    }

    if (filters.query.trim()) {
        query.$text = { $search: filters.query.trim() };
    }

    if (filters.tags.length > 0) {
        query.tags = { $elemMatch: { id: { $in: filters.tags } } };
    }

    if (filters.attachedQR === "on") {
        query.attachedUrl = { $exists: true, $ne: null };
    } else if (filters.attachedQR === "off") {
        query.attachedUrl = { $in: [null, undefined, ""] };
    }

    let sort: Record<string, 1 | -1> = {};
    switch (filters.sortBy) {
        case "date_asc":
            sort = { date: 1 };
            break;
        case "date_desc":
            sort = { date: -1 };
            break;
        case "clicks_asc":
            sort = { "clicks.total": 1 };
            break;
        case "clicks_desc":
            sort = { "clicks.total": -1 };
            break;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [qrcodes, total] = await Promise.all([
        QRCodeV2.find(query).sort(sort).skip(skip).limit(filters.limit).lean(),
        QRCodeV2.countDocuments(query),
    ]);

    const qrcodesSanitized = qrcodes.map((qrcode) => ({
        ...qrcode,
        _id: qrcode._id.toString(),
        tags: qrcode.tags?.map((tag) => ({ ...tag, _id: tag._id.toString() })),
    }));

    return { qrcodes: qrcodesSanitized, total };
};
