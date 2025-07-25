'use server';

import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/auth/User';
import QRCodeV2 from '@/models/url/QRCodeV2';
import UrlV3 from '@/models/url/UrlV3';
import { nanoid } from 'nanoid';
import QRCodeStyling, {
    Options,
} from "qr-code-styling";
import { JSDOM } from "jsdom";
import nodeCanvas from "canvas";
/**
 * Generates a QR code as a base64 PNG using full customization options.
 * @param options - Full set of QRCodeStyling options
 * @returns Base64 PNG data URI string
 */
export async function generateQRCodeBase64(options: Options): Promise<string> {
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

export async function createQrCode({
    longUrl,
    title,
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
        const shortUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/${urlCode}`;

        let resolvedTitle = title?.trim();

        if (!resolvedTitle) {
            resolvedTitle = await fetchPageTitle(longUrl) || "";
        }

        if (!resolvedTitle) {
            resolvedTitle = `QR Code created on ${formatFallbackDate()}`;
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

        const base64 = await generateQRCodeBase64({
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
        });

        const newQrCode = await QRCodeV2.create({
            sub,
            urlId: urlCode,
            qrCodeId: qrShortCode,
            longUrl,
            title,
            tags,
            qrCodeBase64: base64
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
