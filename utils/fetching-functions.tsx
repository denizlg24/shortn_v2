import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import QRCodeV2 from "@/models/url/QRCodeV2";
import UrlV3 from "@/models/url/UrlV3";

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
  } catch (error) {
    return { success: false, url: undefined };
  }
};

export const getQRCode = async (codeID: string) => {
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
    const qr = await QRCodeV2.findOne({ sub, qrCodeId: codeID }).lean();
    if (!qr) {
      return { success: false, qr: undefined };
    }
    const filtered = {
      ...qr,
      _id: qr._id.toString(),
      tags: qr.tags?.map((tag) => ({ ...tag, _id: tag._id.toString() })),
    };
    return { success: true, qr: filtered };
  } catch (error) {
    return { success: false, qr: undefined };
  }
};
