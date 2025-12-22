"use client";

import { createContext, useContext, ReactNode } from "react";
import useSWR from "swr";
import { fetchApi } from "@/lib/utils";
import { SubscriptionsType } from "@/utils/plan-utils";

interface PlanData {
  plan: SubscriptionsType;
  lastPaid?: Date;
}

interface PlanContextValue {
  plan: SubscriptionsType;
  lastPaid?: Date;
  isLoading: boolean;
  error: Error | undefined;
  mutatePlan: () => void;
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

const fetcher = async (): Promise<PlanData> => {
  const res = await fetchApi<PlanData>("auth/user/subscription");
  if (res.success) {
    return { plan: res.plan, lastPaid: res.lastPaid };
  }
  return { plan: "free" };
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<PlanData>(
    "user-plan",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute deduplication
      focusThrottleInterval: 300000, // 5 minutes
      errorRetryCount: 3,
      shouldRetryOnError: true,
      fallbackData: { plan: "free" },
    },
  );

  const value: PlanContextValue = {
    plan: data?.plan ?? "free",
    lastPaid: data?.lastPaid,
    isLoading,
    error,
    mutatePlan: () => mutate(),
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (context === undefined) {
    throw new Error("usePlan must be used within a PlanProvider");
  }
  return context;
}
