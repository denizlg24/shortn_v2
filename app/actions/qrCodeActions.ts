"use server";

import { getServerSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import QRCodeV2 from "@/models/url/QRCodeV2";
import UrlV3 from "@/models/url/UrlV3";
import { nanoid } from "nanoid";
import QRCodeStyling, { Options } from "qr-code-styling";
import { JSDOM } from "jsdom";
import nodeCanvas from "canvas";
import { ITag } from "@/models/url/Tag";
import { fetchApi } from "@/lib/utils";
import Clicks from "@/models/url/Click";
import { headers } from "next/headers";
import { deletePicture } from "./deletePicture";
import { User } from "@/models/auth/User";
import { getUserPlan } from "./stripeActions";

/**
 * Generates a QR code as a base64 PNG using full customization options.
 * @param options - Full set of QRCodeStyling options
 * @returns Base64 PNG data URI string
 */
export async function generateQRCodeBase64(
  options: Partial<Options>,
): Promise<string> {
  const qrCode = new QRCodeStyling({ ...options, jsdom: JSDOM, nodeCanvas });
  const buffer = await qrCode.getRawData("svg");
  if (!buffer) {
    return "";
  }
  return `data:image/svg+xml;base64,${buffer.toString("base64")}`;
}

interface CreateUrlInput {
  longUrl: string;
  title?: string;
  attachedUrl?: string;
  tags?: string[];
  options?: Partial<Options>;
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

export async function createQrCode({
  longUrl,
  title,
  attachedUrl,
  tags = [],
  options,
}: CreateUrlInput) {
  try {
    await connectDB();

    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }

    const sub = user.sub;
    const urlCode = nanoid(6);
    const qrShortCode = nanoid(6);
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol =
      headersList.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");

    const shortUrl = `${protocol}://${host ?? "localhost:3000"}/${urlCode}`;

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
        resolvedTitle = `QR Code created on ${formatFallbackDate()}`;
      }
    }

    const { plan } = await getUserPlan();

    const links = user.qr_codes_this_month;
    if (plan === "free") {
      if (links >= 3) {
        return {
          success: false,
          message: "plan-limit",
        };
      }
    }
    if (plan === "basic") {
      if (links >= 25) {
        return {
          success: false,
          message: "plan-limit",
        };
      }
    }
    if (plan === "plus") {
      if (links >= 50) {
        return {
          success: false,
          message: "plan-limit",
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
      options: options
        ? { ...options, data: newUrl.shortUrl }
        : {
            width: 300,
            height: 300,
            type: "svg",
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
          },
    });

    const updatedUser = await User.findOneAndUpdate(
      { sub: user.sub },
      { $inc: { qr_codes_this_month: 1 } },
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
        qrCodeId: newQrCode.qrCodeId,
        longUrl: newQrCode.longUrl,
        title: newQrCode.title,
      },
    };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      message: "server-error",
    };
  }
}

export const updateQRCodeOptions = async (
  codeId: string,
  options: Partial<Options>,
) => {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }

    const sub = user.sub;
    await connectDB();
    await QRCodeV2.updateOne({ sub, qrCodeId: codeId }, { options });
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false };
  }
};

export const updateQRCodeData = async ({
  qrCodeId,
  title,
  tags,
  applyToLink,
}: {
  qrCodeId: string;
  title: string;
  tags: ITag[];
  applyToLink: boolean;
}) => {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }

    const sub = user.sub;
    await connectDB();
    const qr = await QRCodeV2.findOneAndUpdate(
      { sub, qrCodeId },
      { title, tags },
    );
    if (applyToLink && qr?.attachedUrl) {
      const urlCode = qr.attachedUrl;
      const updatedURL = await UrlV3.findOneAndUpdate(
        { sub, urlCode },
        { title, tags },
      );
      if (updatedURL) {
        return { success: true };
      }
      return { success: false };
    }
    if (qr) return { success: true };
    return { success: false };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false };
  }
};

export const attachShortnToQR = async (urlCode: string, qrCodeId: string) => {
  try {
    await connectDB();
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }

    const sub = user.sub;

    const updated = await QRCodeV2.findOneAndUpdate(
      { sub, qrCodeId },
      { attachedUrl: urlCode },
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

export const deleteQRCode = async (qrCodeId: string) => {
  try {
    await connectDB();
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }

    const sub = user.sub;
    const foundQR = await QRCodeV2.findOneAndDelete({ qrCodeId, sub });
    await Clicks.deleteMany({ urlCode: qrCodeId, type: "scan" });
    if (!foundQR) {
      return { success: true, deleted: qrCodeId };
    }
    if (foundQR.options.image) {
      await deletePicture(foundQR.options.image);
    }
    await UrlV3.findOneAndDelete({
      sub,
      urlCode: foundQR.urlId,
      isQrCode: true,
    });
    if (foundQR.attachedUrl) {
      await UrlV3.findOneAndUpdate(
        { sub, qrCodeId: foundQR.qrCodeId },
        { qrCodeId: "" },
      );
    }
    return { success: true, deleted: qrCodeId };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, message: "server-error" };
  }
};
