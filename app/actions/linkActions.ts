'use server';

import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/auth/User';
import UrlV3, { IUrl } from '@/models/url/UrlV3';
import { addDays } from 'date-fns';
import { nanoid } from 'nanoid';
import { UAParser } from 'ua-parser-js';
import { isbot } from 'isbot';
import { Geo } from '@vercel/functions';
import QRCodeV2 from '@/models/url/QRCodeV2';
import { ITag } from '@/models/url/Tag';
import { getTagById } from './tagActions';

interface CreateUrlInput {
    longUrl: string;
    title?: string;
    tags?: string[];
    customCode?: string;
    qrCodeId?: string;
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

export async function createShortn({
    longUrl,
    title,
    tags = [],
    customCode,
    qrCodeId
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
        const urlCode = customCode || nanoid(6);
        const shortUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${urlCode}`;

        if (customCode) {
            const existing = await UrlV3.findOne({ urlCode: customCode });
            if (existing) {
                return {
                    success: false,
                    message: 'duplicate',
                    existingUrl: customCode,
                };
            }
        }

        let resolvedTitle = title?.trim();

        if (!resolvedTitle) {
            resolvedTitle = await fetchPageTitle(longUrl) || "";
        }

        if (!resolvedTitle) {
            try {
                const url = new URL(longUrl);
                resolvedTitle = `${url.hostname} - untitled`;
            } catch (e) {
                resolvedTitle = `Shortn created on ${formatFallbackDate()}`;
            }
        }

        const dbUser = await User.findOne({ sub: user.sub });
        if (!dbUser) {
            return {
                success: false,
                message: 'no-user',
            };
        }
        const links = dbUser.links_this_month;
        if (dbUser.plan.subscription === "free") {
            if (links >= 3) {
                return {
                    success: false,
                    message: 'plan-limit',
                };
            }
            if (customCode) {
                return {
                    success: false,
                    message: 'custom-restricted',
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
            if (customCode) {
                return {
                    success: false,
                    message: 'custom-restricted',
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
            if (customCode) {
                return {
                    success: false,
                    message: 'custom-restricted',
                };
            }
        }

        const finalTags: ITag[] = [];

        if (tags) {
            for (const t of tags) {
                const tag = await getTagById(t, sub);
                if (tag) {
                    finalTags.push(tag);
                }
            }
        }

        const newUrl = await UrlV3.create({
            sub,
            urlCode,
            customCode: customCode ? true : false,
            longUrl,
            shortUrl,
            title: resolvedTitle,
            tags: finalTags,
            qrCodeId,
        });

        const updatedUser = await User.findOneAndUpdate({ sub: user.sub }, { links_this_month: links + 1 });

        if (!updatedUser) {
            return {
                success: false,
                message: "server-error"
            }
        }

        return {
            success: true,
            data: {
                shortUrl: newUrl.urlCode,
                longUrl: newUrl.longUrl,
                title: newUrl.title,
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
    customLink: "all" | "on" | "off";
    attachedQR: "all" | "on" | "off";
    sortBy: "date_asc" | "date_desc" | "clicks_asc" | "clicks_desc";
    query: string;
    page: number;
    limit: number;
    startDate?: Date;
    endDate?: Date;
}

export const getFilteredLinks = async (
    filters: IFilters,
    userSub: string
): Promise<{ links: IUrl[]; total: number }> => {
    await connectDB();

    const pipeline: any[] = [];

    const matchStage: any = {
        sub: userSub,
        isQrCode: false,
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

    if (filters.customLink === "on") {
        matchStage.customCode = true;
    } else if (filters.customLink === "off") {
        matchStage.customCode = false;
    }

    if (filters.attachedQR === "on") {
        matchStage.qrCodeId = {
            $exists: true,
            $ne: null,
            $not: { $eq: "" }
        };
    } else if (filters.attachedQR === "off") {
        matchStage.qrCodeId = { $in: [null, undefined, ""] };
    }

    if (filters.query.trim()) {
        pipeline.push({
            $search: {
                index: "text-search",
                text: {
                    query: filters.query.trim(),
                    path: ["title", "longUrl", "tags.tagName"]
                }
            }
        });
    }

    // Always apply the match stage after $search
    pipeline.push({ $match: matchStage });

    // Sort
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

    const countPipeline = [...pipeline.filter(stage => !("$skip" in stage || "$limit" in stage)), {
        $count: "total"
    }];

    const [links, totalResult] = await Promise.all([
        UrlV3.aggregate(pipeline).exec(),
        UrlV3.aggregate(countPipeline).exec()
    ]);

    const total = totalResult[0]?.total || 0;

    const linksSanitized = links.map((link) => ({
        ...link,
        _id: link._id.toString(),
        tags: link.tags?.map((tag: ITag) => ({ ...tag, _id: (tag._id as any).toString() })),
    }));

    return { links: linksSanitized, total };
};

export const getShortn = async (sub: string, urlCode: string) => {
    try {
        await connectDB();
        const url = await UrlV3.findOne({ sub, urlCode }).lean();
        if (!url) {
            return { success: false, url: undefined };
        }
        const filtered = { ...url, _id: url._id.toString(), tags: url.tags?.map((tag) => ({ ...tag, _id: tag._id.toString() })) };
        return { success: true, url: filtered };
    } catch (error) {
        return { success: false, url: undefined };
    }
}

export const attachQRToShortn = async (sub: string, urlCode: string, qrCodeId: string) => {
    try {
        await connectDB();
        const updated = await UrlV3.findOneAndUpdate({ sub, urlCode }, { qrCodeId });
        if (!updated) {
            return { success: false, message: 'error-updating' };
        }
        return { success: true };
    } catch (error) {
        return { success: false, message: 'server-error' }
    }
}

export const deleteShortn = async (urlCode: string) => {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }

        const sub = user.sub;
        const foundURL = await UrlV3.findOneAndDelete({ urlCode, sub });
        if (!foundURL) {
            return { success: true, deleted: urlCode };
        }
        if (foundURL.qrCodeId) {
            const detachQR = await QRCodeV2.findOneAndUpdate({ sub, qrCodeId: foundURL.qrCodeId }, { attachedUrl: "" });
        }
        return { success: true, deleted: urlCode };
    } catch (error) {
        return { success: false, message: 'server-error' };
    }
}

export async function recordClickFromMiddleware(clickData: {
    slug: string;
    ip?: string;
    userAgent?: string;
    referrer?: string;
    language?: string;
    timezone?: string;
    geo?: Geo;
    query?: Record<string, string>;
}) {
    const { slug, ip, userAgent = '', referrer, language, geo, query, timezone } = clickData;

    if (isbot(userAgent)) return { ignored: true };

    await connectDB();

    const urlDoc = await UrlV3.findOne({ urlCode: slug });
    if (!urlDoc) return { notFound: true };

    const ua = new UAParser(userAgent).getResult();

    if (urlDoc.qrCodeId) {
        const qrCodeDoc = await QRCodeV2.findOne({ urlId: slug });
        if (!qrCodeDoc) {
            return { notFound: true };
        }
        await qrCodeDoc.recordClick({
            ip,
            country: geo?.country,
            region: geo?.countryRegion,
            city: geo?.city,
            timezone,
            language,
            referrer,
            pathname: `/${slug}`,
            queryParams: query,
            userAgent,
            browser: ua.browser.name,
            os: ua.os.name,
            deviceType: ua.device.type || 'desktop',
        });
        return { success: true };
    }

    await urlDoc.recordClick({
        ip,
        country: geo?.country,
        region: geo?.countryRegion,
        city: geo?.city,
        timezone,
        language,
        referrer,
        pathname: `/${slug}`,
        queryParams: query,
        userAgent,
        browser: ua.browser.name,
        os: ua.os.name,
        deviceType: ua.device.type || 'desktop',
    });

    return { success: true };
}
