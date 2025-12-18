"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/utils";
import { TUrl } from "@/models/url/UrlV3";
import { TQRCode } from "@/models/url/QRCodeV2";
import { DashboardStats } from "./dashboard-stats";
import { RecentActivity } from "./recent-activity";
import { SubscriptionsType } from "@/utils/plan-utils";

interface DashboardData {
  totalLinks: number;
  totalQRCodes: number;
  totalClicks: number;
  totalScans: number;
  recentLinks: TUrl[];
  recentQRCodes: TQRCode[];
  topLink?: TUrl;
  topQRCode?: TQRCode;
}

export const DashboardOverview = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<SubscriptionsType>("free");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [dashboardResponse, planResponse] = await Promise.all([
          fetchApi<{ data: DashboardData }>("dashboard/stats"),
          fetchApi<{ plan: SubscriptionsType; lastPaid?: Date }>(
            "auth/user/subscription",
          ),
        ]);

        if (dashboardResponse.success) {
          setData(dashboardResponse.data);
        }

        if (planResponse.success) {
          setPlan(planResponse.plan);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <>
      <DashboardStats
        stats={
          data
            ? {
                totalLinks: data.totalLinks,
                totalQRCodes: data.totalQRCodes,
                totalClicks: data.totalClicks,
                totalScans: data.totalScans,
              }
            : undefined
        }
        loading={loading}
        plan={plan}
      />

      <RecentActivity
        recentLinks={data?.recentLinks}
        recentQRCodes={data?.recentQRCodes}
        topLink={data?.topLink}
        topQRCode={data?.topQRCode}
        loading={loading}
        plan={plan}
        className="lg:col-span-2"
      />
    </>
  );
};
