'use server';

import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/auth/User';
import UrlV3 from '@/models/url/UrlV3';
import { nanoid } from 'nanoid';

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
            resolvedTitle = `Shortn created on ${formatFallbackDate()}`;
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
