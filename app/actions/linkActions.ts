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

interface CreateUrlInput {
    longUrl: string;
    title?: string;
    tags?: string[];
    customCode?: string;
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
        const shortUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/${urlCode}`;

        if (customCode) {
            const existing = await UrlV3.findOne({ urlCode: customCode });
            if (existing) {
                return {
                    success: false,
                    message: 'This URL already exists in your account.',
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

        const newUrl = await UrlV3.create({
            sub,
            urlCode,
            customCode: customCode ? true : false,
            longUrl,
            shortUrl,
            title: resolvedTitle,
            tags,
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
                tags: newUrl.tags,
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

    const query: any = {
        sub: userSub,
        isQrCode: false,
    };
    if (filters.startDate || filters.endDate) {
        query.date = {};
        if (filters.startDate) {
            query.date.$gte = filters.startDate;
        }
        if (filters.endDate) {
            query.date.$lte = addDays(filters.endDate, 1);
        }
        console.log(query.date);
    }

    if (filters.query.trim()) {
        query.$text = { $search: filters.query.trim() };
    }

    if (filters.tags.length > 0) {
        query.tags = { $elemMatch: { id: { $in: filters.tags } } };
    }

    if (filters.customLink === "on") {
        query.customCode = true;
    } else if (filters.customLink === "off") {
        query.customCode = false;
    }

    if (filters.attachedQR === "on") {
        query.qrCodeId = { $exists: true, $ne: null };
    } else if (filters.attachedQR === "off") {
        query.qrCodeId = { $in: [null, undefined, ""] };
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
    const [links, total] = await Promise.all([
        UrlV3.find(query).sort(sort).skip(skip).limit(filters.limit).lean(),
        UrlV3.countDocuments(query),
    ]);

    const linksSanitized = links.map((link) => ({
        ...link,
        _id: link._id.toString(),
        tags: link.tags?.map((tag) => ({ ...tag, _id: tag._id.toString() })),
    }));

    return { links: linksSanitized, total };
};

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
