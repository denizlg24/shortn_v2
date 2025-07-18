'use server';

import { UAParser } from 'ua-parser-js';
import { isbot } from 'isbot';
import { connectDB } from '@/lib/mongodb';
import UrlV3 from '@/models/url/UrlV3';
import { Geo } from '@vercel/functions';

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