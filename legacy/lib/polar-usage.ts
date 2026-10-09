import { polarClient } from "./polar";

export const METER_EVENTS = {
  LINK_CREATED: "link_created",
  QR_CODE_CREATED: "qr_code_created",
  LINK_REDIRECT: "link_redirect",
  QR_CODE_REDIRECT: "qr_code_redirect",
} as const;

type MeterEvent = (typeof METER_EVENTS)[keyof typeof METER_EVENTS];

const PLAN_LIMITS: Record<string, Record<MeterEvent, number>> = {
  free: {
    [METER_EVENTS.LINK_CREATED]: 3,
    [METER_EVENTS.QR_CODE_CREATED]: 3,
    [METER_EVENTS.LINK_REDIRECT]: 0,
    [METER_EVENTS.QR_CODE_REDIRECT]: 0,
  },
  basic: {
    [METER_EVENTS.LINK_CREATED]: 25,
    [METER_EVENTS.QR_CODE_CREATED]: 25,
    [METER_EVENTS.LINK_REDIRECT]: 0,
    [METER_EVENTS.QR_CODE_REDIRECT]: 0,
  },
  plus: {
    [METER_EVENTS.LINK_CREATED]: 50,
    [METER_EVENTS.QR_CODE_CREATED]: 50,
    [METER_EVENTS.LINK_REDIRECT]: 10,
    [METER_EVENTS.QR_CODE_REDIRECT]: 10,
  },
  pro: {
    [METER_EVENTS.LINK_CREATED]: Infinity,
    [METER_EVENTS.QR_CODE_CREATED]: Infinity,
    [METER_EVENTS.LINK_REDIRECT]: Infinity,
    [METER_EVENTS.QR_CODE_REDIRECT]: Infinity,
  },
};

export async function ingestUsageEvent({
  customerId,
  eventName,
  metadata = {},
}: {
  customerId: string;
  eventName: MeterEvent;
  metadata?: Record<string, string | number | boolean>;
}) {
  try {
    const result = await polarClient.events.ingest({
      events: [
        {
          name: eventName,
          externalCustomerId: customerId,
          metadata,
        },
      ],
    });

    return { success: true, inserted: result.inserted };
  } catch (error) {
    console.error(
      `[Polar Usage] Failed to ingest event "${eventName}":`,
      error,
    );
    return { success: false, error };
  }
}

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

export async function countEventsThisMonth(
  customerId: string,
  eventName: MeterEvent,
): Promise<{ count: number; success: boolean }> {
  try {
    const startOfMonth = getStartOfMonth();

    const result = await polarClient.events.list({
      externalCustomerId: customerId,
      name: eventName,
      startTimestamp: startOfMonth,
      limit: 1, // We just need the total_count from pagination
    });

    const pagination =
      "result" in result
        ? (result as { result: { pagination: { totalCount: number } } }).result
            .pagination
        : (result as { pagination: { totalCount: number } }).pagination;

    const count = pagination.totalCount;

    return { count, success: true };
  } catch (error) {
    console.error(
      `[Polar Usage] Failed to count events for ${eventName}:`,
      error,
    );
    return { count: 0, success: false };
  }
}

type MeterData = {
  consumedUnits: number;
  creditedUnits: number;
  balance: number;
  meterName: string;
};

export async function getCustomerMeters(customerId: string): Promise<{
  success: boolean;
  meters: Record<string, MeterData>;
  error?: unknown;
}> {
  try {
    const result = await polarClient.customerMeters.list({
      externalCustomerId: customerId,
      limit: 100,
    });

    const meters: Record<string, MeterData> = {};

    for (const item of result.result.items) {
      const meterName = item.meter.name;
      meters[meterName] = {
        consumedUnits: item.consumedUnits,
        creditedUnits: item.creditedUnits,
        balance: item.balance,
        meterName,
      };
    }

    return { success: true, meters };
  } catch (error) {
    console.error(
      `[Polar Usage] Failed to get meters for customer ${customerId}:`,
      error,
    );
    return { success: false, meters: {}, error };
  }
}

export async function canPerformAction(
  customerId: string,
  meterEvent: MeterEvent,
  plan: string,
): Promise<{
  allowed: boolean;
  balance: number;
  limit: number;
  consumed: number;
}> {
  const { meters } = await getCustomerMeters(customerId);
  const meter = meters[meterEvent];

  if (meter && meter.creditedUnits > 0) {
    return {
      allowed: meter.balance > 0,
      balance: meter.balance,
      limit: meter.creditedUnits,
      consumed: meter.consumedUnits,
    };
  }

  const { count: consumed } = await countEventsThisMonth(
    customerId,
    meterEvent,
  );

  const planLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const limit = planLimits[meterEvent] ?? 0;
  const balance = Math.max(0, limit - consumed);

  console.log(
    `[Polar Usage] Using Events count for ${meterEvent}: plan=${plan}, consumed=${consumed}, limit=${limit}, balance=${balance}`,
  );

  return {
    allowed: balance > 0,
    balance,
    limit,
    consumed,
  };
}

export async function getUsageSummary(customerId: string, plan: string) {
  const { meters } = await getCustomerMeters(customerId);

  const hasCustomerMeters = Object.values(meters).some(
    (m) => m.creditedUnits > 0,
  );

  if (hasCustomerMeters) {
    return {
      linksThisMonth: meters[METER_EVENTS.LINK_CREATED] ?? null,
      qrCodesThisMonth: meters[METER_EVENTS.QR_CODE_CREATED] ?? null,
      linkRedirectsThisMonth: meters[METER_EVENTS.LINK_REDIRECT] ?? null,
      qrCodeRedirectsThisMonth: meters[METER_EVENTS.QR_CODE_REDIRECT] ?? null,
    };
  }

  const [
    linksResult,
    qrCodesResult,
    linkRedirectsResult,
    qrCodeRedirectsResult,
  ] = await Promise.all([
    countEventsThisMonth(customerId, METER_EVENTS.LINK_CREATED),
    countEventsThisMonth(customerId, METER_EVENTS.QR_CODE_CREATED),
    countEventsThisMonth(customerId, METER_EVENTS.LINK_REDIRECT),
    countEventsThisMonth(customerId, METER_EVENTS.QR_CODE_REDIRECT),
  ]);

  const planLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  return {
    linksThisMonth: {
      consumedUnits: linksResult.count,
      creditedUnits: planLimits[METER_EVENTS.LINK_CREATED],
      balance: Math.max(
        0,
        planLimits[METER_EVENTS.LINK_CREATED] - linksResult.count,
      ),
      meterName: METER_EVENTS.LINK_CREATED,
    },
    qrCodesThisMonth: {
      consumedUnits: qrCodesResult.count,
      creditedUnits: planLimits[METER_EVENTS.QR_CODE_CREATED],
      balance: Math.max(
        0,
        planLimits[METER_EVENTS.QR_CODE_CREATED] - qrCodesResult.count,
      ),
      meterName: METER_EVENTS.QR_CODE_CREATED,
    },
    linkRedirectsThisMonth: {
      consumedUnits: linkRedirectsResult.count,
      creditedUnits: planLimits[METER_EVENTS.LINK_REDIRECT],
      balance: Math.max(
        0,
        planLimits[METER_EVENTS.LINK_REDIRECT] - linkRedirectsResult.count,
      ),
      meterName: METER_EVENTS.LINK_REDIRECT,
    },
    qrCodeRedirectsThisMonth: {
      consumedUnits: qrCodeRedirectsResult.count,
      creditedUnits: planLimits[METER_EVENTS.QR_CODE_REDIRECT],
      balance: Math.max(
        0,
        planLimits[METER_EVENTS.QR_CODE_REDIRECT] - qrCodeRedirectsResult.count,
      ),
      meterName: METER_EVENTS.QR_CODE_REDIRECT,
    },
  };
}

export { PLAN_LIMITS };
