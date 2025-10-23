"use server";

import { headers } from "next/headers";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/auth/User";
import UrlV3 from "@/models/url/UrlV3";
import { nanoid } from "nanoid";
import { UAParser } from "ua-parser-js";
import { isbot } from "isbot";
import { Geo } from "@vercel/functions";
import QRCodeV2 from "@/models/url/QRCodeV2";
import { ITag } from "@/models/url/Tag";
import { fetchApi } from "@/lib/utils";
import Clicks from "@/models/url/Click";
import { parse } from "json2csv";

interface CreateUrlInput {
  longUrl: string;
  title?: string;
  tags?: string[];
  customCode?: string;
  qrCodeId?: string;
}

async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "GET" });
    const html = await res.text();
    const match = html.match(/<title>(.*?)<\/title>/i);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function formatFallbackDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function createShortn({
  longUrl,
  title,
  tags = [],
  customCode,
  qrCodeId,
}: CreateUrlInput) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    await connectDB();
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol =
      headersList.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");
    const urlCode = customCode || nanoid(6);
    const shortUrl = `${protocol}://${host ?? "localhost:3000"}/${urlCode}`;

    if (customCode) {
      const existing = await UrlV3.findOne({ urlCode: customCode });
      if (existing) {
        return {
          success: false,
          message: "duplicate",
          existingUrl: customCode,
        };
      }
    }

    let resolvedTitle = title?.trim();

    if (!resolvedTitle) {
      resolvedTitle = (await fetchPageTitle(longUrl)) || "";
    }

    if (!resolvedTitle) {
      try {
        const url = new URL(longUrl);
        resolvedTitle = `${url.hostname} - untitled`;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        resolvedTitle = `Shortn created on ${formatFallbackDate()}`;
      }
    }

    const dbUser = await User.findOne({ sub: user.sub });
    if (!dbUser) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const links = dbUser.links_this_month;
    if (dbUser.plan.subscription === "free") {
      if (links >= 3) {
        return {
          success: false,
          message: "plan-limit",
        };
      }
      if (customCode) {
        return {
          success: false,
          message: "custom-restricted",
        };
      }
    }
    if (dbUser.plan.subscription === "basic") {
      if (links >= 25) {
        return {
          success: false,
          message: "plan-limit",
        };
      }
      if (customCode) {
        return {
          success: false,
          message: "custom-restricted",
        };
      }
    }
    if (dbUser.plan.subscription === "plus") {
      if (links >= 50) {
        return {
          success: false,
          message: "plan-limit",
        };
      }
      if (customCode) {
        return {
          success: false,
          message: "custom-restricted",
        };
      }
    }

    const finalTags: ITag[] = [];

    if (tags) {
      for (const t of tags) {
        const tag = await fetchApi<{ tag: ITag }>(`tags/${t}`);
        if (tag.success) {
          finalTags.push(tag.tag);
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

    const updatedUser = await User.findOneAndUpdate(
      { sub: user.sub },
      { links_this_month: links + 1 },
    );

    if (!updatedUser) {
      return {
        success: false,
        message: "server-error",
      };
    }

    return {
      success: true,
      data: {
        shortUrl: newUrl.urlCode,
        longUrl: newUrl.longUrl,
        title: newUrl.title,
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return {
      success: false,
      message: "server-error",
    };
  }
}

export const getShortn = async (urlCode: string) => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    await connectDB();
    const url = await UrlV3.findOne({ sub, urlCode }).lean();
    if (!url) {
      return { success: false, url: undefined };
    }
    const filtered = {
      ...url,
      _id: url._id.toString(),
      tags: url.tags?.map((tag) => ({ ...tag, _id: tag._id.toString() })),
    };
    return { success: true, url: filtered };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, url: undefined };
  }
};

export const attachQRToShortn = async (urlCode: string, qrCodeId: string) => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    await connectDB();
    const updated = await UrlV3.findOneAndUpdate(
      { sub, urlCode },
      { qrCodeId },
    );
    if (!updated) {
      return { success: false, message: "error-updating" };
    }
    return { success: true };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, message: "server-error" };
  }
};

export const deleteShortn = async (urlCode: string) => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    const foundURL = await UrlV3.findOneAndDelete({ urlCode, sub });
    await Clicks.deleteMany({ urlCode, type: "click" });
    if (!foundURL) {
      return { success: true, deleted: urlCode };
    }
    if (foundURL.qrCodeId) {
      await QRCodeV2.findOneAndUpdate(
        { sub, qrCodeId: foundURL.qrCodeId },
        { attachedUrl: "" },
      );
    }
    return { success: true, deleted: urlCode };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, message: "server-error" };
  }
};

export const updateShortnData = async ({
  urlCode,
  title,
  tags,
  custom_code,
  applyToQRCode,
}: {
  urlCode: string;
  title: string;
  tags: ITag[];
  custom_code?: string;
  applyToQRCode: boolean;
}) => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    await connectDB();
    if (custom_code && urlCode != custom_code) {
      const existing = await UrlV3.findOne({ urlCode: custom_code });
      if (existing) {
        return {
          success: false,
          message: "duplicate",
          existingUrl: custom_code,
        };
      }
    }

    const dbUser = await User.findOne({ sub });
    if (!dbUser) {
      return { success: false, message: "no-user" };
    }
    if (custom_code && dbUser.plan.subscription != "pro") {
      return { success: false, message: "custom-restricted" };
    }
    const headersList = await headers();
    const domain = headersList.get("host");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateQuery: Record<string, any> = {};
    updateQuery.title = title;
    updateQuery.tags = tags;
    let updateCode: false | string = false;
    if (custom_code) {
      updateQuery.urlCode = custom_code;
      updateQuery.custom_code = true;
      updateQuery.shortUrl = `${domain || "http://localhost:3000"}/${custom_code}`;
      updateCode = custom_code;
    }
    const url = await UrlV3.findOneAndUpdate({ sub, urlCode }, updateQuery, {
      new: true,
    });
    if (updateCode) {
      await Clicks.updateMany(
        { type: "click", urlCode },
        { urlCode: custom_code },
      );
    }
    if (applyToQRCode && url?.qrCodeId) {
      const qrCodeId = url.qrCodeId;
      const updatedQR = await QRCodeV2.findOneAndUpdate(
        { sub, qrCodeId },
        { title, tags },
      );
      if (updatedQR) {
        return { success: true };
      }
      return { success: false };
    }

    if (url) return { success: true, urlCode: url.urlCode };
    return { success: false };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false };
  }
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
  try {
    const {
      slug,
      ip,
      userAgent = "",
      referrer,
      language,
      geo,
      query,
      timezone,
    } = clickData;

    if (isbot(userAgent)) return { ignored: true };

    await connectDB();

    const urlDoc = await UrlV3.findOne({ urlCode: slug });
    if (!urlDoc) return { notFound: true };

    const ua = new UAParser(userAgent).getResult();

    if (urlDoc.qrCodeId && urlDoc.isQrCode) {
      const qrCodeDoc = await QRCodeV2.findOne({ urlId: slug });
      if (!qrCodeDoc) {
        return { notFound: true };
      }
      await qrCodeDoc.recordClick();
      await Clicks.create({
        urlCode: qrCodeDoc.qrCodeId,
        type: "scan",
        sub: qrCodeDoc.sub,
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
        deviceType: ua.device.type || "desktop",
      });
      return { success: true };
    }

    await urlDoc.recordClick();
    await Clicks.create({
      urlCode: urlDoc.urlCode,
      sub: urlDoc.sub,
      type: "click",
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
      deviceType: ua.device.type || "desktop",
    });

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false };
  }
}

export async function generateCSV({
  code,
  type,
}: {
  code: string;
  type: "click" | "scan";
}) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return { success: false, url: "" };
    }

    await connectDB();
    const clicks = await Clicks.find({ type, urlCode: code })
      .select("-_id -__v -sub -urlCode -type -ip")
      .lean();
    if (!clicks) {
      return { success: false, url: "" };
    }
    const csv = parse(clicks);

    const base64 = Buffer.from(csv).toString("base64");

    return { success: true, url: `data:text/csv;base64,${base64}` };
  } catch (error) {
    console.log(error);
    return { success: false, url: "" };
  }
}

export async function generateCSVFromClicks({ clicks }: { clicks: unknown[] }) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return { success: false, url: "" };
    }

    const csv = parse(clicks);

    const base64 = Buffer.from(csv).toString("base64");

    return { success: true, url: `data:text/csv;base64,${base64}` };
  } catch (error) {
    console.log(error);
    return { success: false, url: "" };
  }
}
