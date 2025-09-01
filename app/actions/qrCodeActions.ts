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
import { ITag } from '@/models/url/Tag';
import { fetchApi } from '@/lib/utils';

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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                const tag = await fetchApi<{ tag: ITag }>(`tags/${t}`);
                if (tag.success) {
                    finalTags.push(tag.tag);
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

export const updateQRCodeOptions = async (codeId: string, options: Partial<Options>) => {
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
        await connectDB();
        const finalOptions = {
            ...options, jsdom: JSDOM,
            nodeCanvas,
        }
        const base64 = await generateQRCodeBase64(finalOptions);
        await QRCodeV2.findOneAndUpdate({ sub, qrCodeId: codeId }, { options, qrCodeBase64: base64 });
        return { success: true };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return { success: false };
    }
}

export const updateQRCodeData = async ({ qrCodeId, title, tags, applyToLink }: { qrCodeId: string, title: string, tags: ITag[], applyToLink: boolean }) => {
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
        await connectDB();
        const qr = await QRCodeV2.findOneAndUpdate({ sub, qrCodeId }, { title, tags });
        if (applyToLink && qr?.attachedUrl) {
            const urlCode = qr.attachedUrl;
            const updatedURL = await UrlV3.findOneAndUpdate({ sub, urlCode }, { title, tags });
            if (updatedURL) {
                return { success: true };
            }
            return { success: false };
        }
        if (qr)
            return { success: true };
        return { success: false };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return { success: false };
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        await UrlV3.findOneAndDelete({ sub, urlCode: foundQR.urlId, isQrCode: true });
        if (foundQR.attachedUrl) {
            await UrlV3.findOneAndUpdate({ sub, qrCodeId: foundQR.qrCodeId }, { qrCodeId: "" });
        }
        return { success: true, deleted: qrCodeId };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return { success: false, message: 'server-error' };
    }
}
