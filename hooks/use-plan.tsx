"use client";

import { createContext, useContext, ReactNode, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { fetchApi } from "@/lib/utils";
import { SubscriptionsType } from "@/utils/plan-utils";
import { authClient } from "@/lib/authClient";

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
  clearPlanCache: () => void;
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

const PLAN_CACHE_KEY = "user-plan";

const fetcher = async (): Promise<PlanData> => {
  const res = await fetchApi<PlanData>("auth/user/subscription");
  if (res.success) {
    return { plan: res.plan, lastPaid: res.lastPaid };
  }
  return { plan: "free" };
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const { data: sessionData } = authClient.useSession();

  const {
    data,
    error,
    isLoading,
    mutate: mutateSWR,
  } = useSWR<PlanData>(PLAN_CACHE_KEY, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000,
    focusThrottleInterval: 300000,
    errorRetryCount: 3,
    shouldRetryOnError: true,
    fallbackData: { plan: "free" },
  });

  useEffect(() => {
    if (sessionData?.user) {
      mutateSWR();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.user?.sub]);

  const clearPlanCache = () => {
    mutate(PLAN_CACHE_KEY, { plan: "free" }, false);
  };

  const value: PlanContextValue = {
    plan: data?.plan ?? "free",
    lastPaid: data?.lastPaid,
    isLoading,
    error,
    mutatePlan: () => mutateSWR(),
    clearPlanCache,
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

export function clearPlanCacheGlobal() {
  mutate(PLAN_CACHE_KEY, { plan: "free" }, false);
}
