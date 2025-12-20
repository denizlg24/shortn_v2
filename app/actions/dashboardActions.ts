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

    const totalLinks = await UrlV3.countDocuments({ sub, isQrCode: false });
    const totalQRCodes = await QRCodeV2.countDocuments({ sub });

    const recentLinks = await UrlV3.find({ sub, isQrCode: false })
      .sort({ date: -1 })
      .limit(5)
      .lean();

    const recentQRCodes = await QRCodeV2.find({ sub })
      .sort({ date: -1 })
      .limit(3)
      .lean();

    let topLink = undefined;
    let topQRCode = undefined;
    let totalClicks = 0;
    let totalScans = 0;

    if (canSeeClicks) {
      topLink = await UrlV3.findOne({ sub, isQrCode: false })
        .sort({ "clicks.total": -1 })
        .limit(1)
        .lean();

      topQRCode = await QRCodeV2.findOne({ sub })
        .sort({ "clicks.total": -1 })
        .limit(1)
        .lean();

      const linksWithClicks = await UrlV3.find({ sub, isQrCode: false })
        .select("clicks.total")
        .lean();
      totalClicks = linksWithClicks.reduce(
        (sum, link) => sum + (link.clicks?.total || 0),
        0,
      );

      const qrCodesWithScans = await QRCodeV2.find({ sub })
        .select("clicks.total")
        .lean();
      totalScans = qrCodesWithScans.reduce(
        (sum, qr) => sum + (qr.clicks?.total || 0),
        0,
      );
    }

    return {
      success: true,
      data: {
        totalLinks,
        totalQRCodes,
        totalClicks: canSeeClicks ? totalClicks : 0,
        totalScans: canSeeClicks ? totalScans : 0,
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
