"use server";

import { getServerSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import UrlV3, { TUrl } from "@/models/url/UrlV3";
import QRCodeV2, { TQRCode } from "@/models/url/QRCodeV2";
import { getUserPlan } from "@/app/actions/polarActions";

interface DashboardStats {
  totalLinks: number;
  totalQRCodes: number;
  totalClicks: number;
  totalScans: number;
  recentLinks: TUrl[];
  recentQRCodes: TQRCode[];
  topLink?: TUrl;
  topQRCode?: TQRCode;
}

export async function getDashboardStats(): Promise<{
  success: boolean;
  data?: DashboardStats;
  message?: string;
}> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }

    const sub = session.user.sub;
    await connectDB();

    const { plan } = await getUserPlan();
    const canSeeClicks = plan && plan !== "free";

    const [
      totalLinks,
      totalQRCodes,
      recentLinks,
      recentQRCodes,
      topLink,
      topQRCode,
      clicksAggregation,
      scansAggregation,
    ] = await Promise.all([
      UrlV3.countDocuments({ sub, isQrCode: false }),
      QRCodeV2.countDocuments({ sub }),
      UrlV3.find({ sub, isQrCode: false }).sort({ date: -1 }).limit(5).lean(),
      QRCodeV2.find({ sub }).sort({ date: -1 }).limit(3).lean(),
      canSeeClicks
        ? UrlV3.findOne({ sub, isQrCode: false })
            .sort({ "clicks.total": -1 })
            .limit(1)
            .lean()
        : Promise.resolve(null),
      canSeeClicks
        ? QRCodeV2.findOne({ sub }).sort({ "clicks.total": -1 }).limit(1).lean()
        : Promise.resolve(null),

      canSeeClicks
        ? UrlV3.aggregate([
            { $match: { sub, isQrCode: false } },
            { $group: { _id: null, total: { $sum: "$clicks.total" } } },
          ])
        : Promise.resolve([]),
      canSeeClicks
        ? QRCodeV2.aggregate([
            { $match: { sub } },
            { $group: { _id: null, total: { $sum: "$clicks.total" } } },
          ])
        : Promise.resolve([]),
    ]);

    const totalClicks = canSeeClicks ? (clicksAggregation[0]?.total ?? 0) : 0;

    const totalScans = canSeeClicks ? (scansAggregation[0]?.total ?? 0) : 0;

    return {
      success: true,
      data: {
        totalLinks,
        totalQRCodes,
        totalClicks,
        totalScans,
        recentLinks: recentLinks.map((link) => ({
          ...link,
          _id: link._id.toString(),

          clicks: canSeeClicks ? link.clicks : { total: 0, lastClick: null },
        })) as TUrl[],
        recentQRCodes: recentQRCodes.map((qr) => ({
          ...qr,
          _id: qr._id.toString(),

          clicks: canSeeClicks ? qr.clicks : { total: 0, lastClick: null },
        })) as TQRCode[],
        topLink:
          canSeeClicks && topLink
            ? ({ ...topLink, _id: topLink._id.toString() } as TUrl)
            : undefined,
        topQRCode:
          canSeeClicks && topQRCode
            ? ({ ...topQRCode, _id: topQRCode._id.toString() } as TQRCode)
            : undefined,
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return { success: false, message: "server-error" };
  }
}
