"use server";

import { getServerSession } from "@/lib/session";
import { getUsageSummary, PLAN_LIMITS, METER_EVENTS } from "@/lib/polar-usage";
import { getUserPlan } from "@/app/actions/polarActions";

export type UsageData = {
  links: {
    consumed: number;
    limit: number;
    balance: number;
  };
  qrCodes: {
    consumed: number;
    limit: number;
    balance: number;
  };
  linkRedirects: {
    consumed: number;
    limit: number;
    balance: number;
  };
  qrCodeRedirects: {
    consumed: number;
    limit: number;
    balance: number;
  };
};

export async function getCurrentUsage(): Promise<{
  success: boolean;
  data: UsageData | null;
  plan: string;
}> {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return { success: false, data: null, plan: "free" };
    }

    const { plan } = await getUserPlan();
    const usage = await getUsageSummary(user.id, plan);

    if (!usage) {
      const planLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
      return {
        success: true,
        plan,
        data: {
          links: {
            consumed: 0,
            limit: planLimits[METER_EVENTS.LINK_CREATED],
            balance: planLimits[METER_EVENTS.LINK_CREATED],
          },
          qrCodes: {
            consumed: 0,
            limit: planLimits[METER_EVENTS.QR_CODE_CREATED],
            balance: planLimits[METER_EVENTS.QR_CODE_CREATED],
          },
          linkRedirects: {
            consumed: 0,
            limit: planLimits[METER_EVENTS.LINK_REDIRECT],
            balance: planLimits[METER_EVENTS.LINK_REDIRECT],
          },
          qrCodeRedirects: {
            consumed: 0,
            limit: planLimits[METER_EVENTS.QR_CODE_REDIRECT],
            balance: planLimits[METER_EVENTS.QR_CODE_REDIRECT],
          },
        },
      };
    }

    return {
      success: true,
      plan,
      data: {
        links: {
          consumed: usage.linksThisMonth?.consumedUnits ?? 0,
          limit: usage.linksThisMonth?.creditedUnits ?? 0,
          balance: usage.linksThisMonth?.balance ?? 0,
        },
        qrCodes: {
          consumed: usage.qrCodesThisMonth?.consumedUnits ?? 0,
          limit: usage.qrCodesThisMonth?.creditedUnits ?? 0,
          balance: usage.qrCodesThisMonth?.balance ?? 0,
        },
        linkRedirects: {
          consumed: usage.linkRedirectsThisMonth?.consumedUnits ?? 0,
          limit: usage.linkRedirectsThisMonth?.creditedUnits ?? 0,
          balance: usage.linkRedirectsThisMonth?.balance ?? 0,
        },
        qrCodeRedirects: {
          consumed: usage.qrCodeRedirectsThisMonth?.consumedUnits ?? 0,
          limit: usage.qrCodeRedirectsThisMonth?.creditedUnits ?? 0,
          balance: usage.qrCodeRedirectsThisMonth?.balance ?? 0,
        },
      },
    };
  } catch (error) {
    console.error("[getCurrentUsage] Error fetching usage:", error);
    return { success: false, data: null, plan: "free" };
  }
}
