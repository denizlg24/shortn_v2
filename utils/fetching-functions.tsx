import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Clicks, { ClickEntry } from "@/models/url/Click";
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, url: undefined };
  }
};

export const getClicks = async (
  urlCode: string,
  startDate: Date | undefined,
  endDate: Date | undefined
) => {
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
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = startDate;
    }
    if (endDate) {
      dateFilter.$lte = endDate;
    }
    const query: any = { urlCode, sub, type: "click" };
    if (Object.keys(dateFilter).length > 0) {
      query.timestamp = dateFilter;
    }
    const clicks = await Clicks.find(query).lean();
    let filtered: ClickEntry[] = [];
    switch (user.plan.subscription) {
      case "free":
      case "basic":
        filtered = [];
        break;
      case "plus":
        filtered = clicks.map((click) => ({
          ...click,
          deviceType: undefined,
          browser: undefined,
          os: undefined,
          referrer: undefined,
          _id: (click._id as any).toString(),
        }));
        break;
      case "pro":
        filtered = clicks.map((click) => ({
          ...click,
          _id: (click._id as any).toString(),
        }));
        break;
      default:
        filtered = [];
        break;
    }
    return filtered;
  } catch (error) {
    return [];
  }
};

export const getScans = async (
  qrCodeId: string,
  startDate: Date | undefined,
  endDate: Date | undefined
) => {
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
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = startDate;
    }
    if (endDate) {
      dateFilter.$lte = endDate;
    }
    const query: any = { urlCode: qrCodeId, sub, type: "scan" };
    if (Object.keys(dateFilter).length > 0) {
      query.timestamp = dateFilter;
    }
    const clicks = await Clicks.find(query).lean();
    let filtered: ClickEntry[] = [];
    switch (user.plan.subscription) {
      case "free":
      case "basic":
        filtered = [];
        break;
      case "plus":
        filtered = clicks.map((click) => ({
          ...click,
          deviceType: undefined,
          browser: undefined,
          os: undefined,
          referrer: undefined,
          _id: (click._id as any).toString(),
        }));
        break;
      case "pro":
        filtered = clicks.map((click) => ({
          ...click,
          _id: (click._id as any).toString(),
        }));
        break;
      default:
        filtered = [];
        break;
    }
    return filtered;
  } catch (error) {
    return [];
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, qr: undefined };
  }
};
