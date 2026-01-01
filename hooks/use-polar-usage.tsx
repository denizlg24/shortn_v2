"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/authClient";

export const METER_NAMES = {
  LINK_CREATED: "link_created",
  QR_CODE_CREATED: "qr_code_created",
  LINK_REDIRECT: "link_redirect",
  QR_CODE_REDIRECT: "qr_code_redirect",
} as const;

export type MeterData = {
  consumedUnits: number;
  creditedUnits: number;
  balance: number;
  meterName: string;
};

export type UsageData = {
  linksThisMonth: MeterData | null;
  qrCodesThisMonth: MeterData | null;
  linkRedirectsThisMonth: MeterData | null;
  qrCodeRedirectsThisMonth: MeterData | null;
};

export function usePolarUsage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authClient.usage.meters.list({
        query: {
          limit: 100,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch usage data");
      }

      const meters: Record<string, MeterData> = {};

      const items = response.data;
      if (items && Array.isArray(items)) {
        for (const item of items) {
          const meterName = item.meter?.name || "";
          meters[meterName] = {
            consumedUnits: item.consumedUnits ?? 0,
            creditedUnits: item.creditedUnits ?? 0,
            balance: item.balance ?? 0,
            meterName,
          };
        }
      }

      setUsage({
        linksThisMonth: meters[METER_NAMES.LINK_CREATED] ?? null,
        qrCodesThisMonth: meters[METER_NAMES.QR_CODE_CREATED] ?? null,
        linkRedirectsThisMonth: meters[METER_NAMES.LINK_REDIRECT] ?? null,
        qrCodeRedirectsThisMonth: meters[METER_NAMES.QR_CODE_REDIRECT] ?? null,
      });
    } catch (err) {
      console.error("[usePolarUsage] Failed to fetch usage:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    isLoading,
    error,
    refetchUsage: fetchUsage,
  };
}

export function getUsageRemaining(meterData: MeterData | null): number {
  if (!meterData) return 0;
  return Math.max(0, meterData.balance);
}

export function getUsageConsumed(meterData: MeterData | null): number {
  if (!meterData) return 0;
  return meterData.consumedUnits;
}

export function getUsageLimit(meterData: MeterData | null): number {
  if (!meterData) return 0;
  return meterData.creditedUnits;
}

export function canPerformAction(meterData: MeterData | null): boolean {
  if (!meterData) return true; // No meter data = unlimited (or meter not set up yet)
  return meterData.balance > 0;
}
