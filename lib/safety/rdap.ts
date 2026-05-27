export interface DomainAgeResult {
  available: boolean;
  registeredAt: Date | null;
  ageDays: number | null;
}

const NEW_DOMAIN_THRESHOLD_DAYS = 30;

/**
 * Best-effort domain registration age via RDAP (free, no key). Used as a soft
 * signal: newly registered domains are correlated with abuse. Failures are
 * non-fatal and simply mark the result unavailable.
 */
export async function getDomainAge(hostname: string): Promise<DomainAgeResult> {
  const domain = hostname.replace(/^www\./, "");

  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      headers: { Accept: "application/rdap+json" },
    });

    if (!res.ok) {
      return { available: false, registeredAt: null, ageDays: null };
    }

    const data = (await res.json()) as {
      events?: { eventAction: string; eventDate: string }[];
    };

    const registration = data.events?.find(
      (e) => e.eventAction === "registration",
    );

    if (!registration?.eventDate) {
      return { available: false, registeredAt: null, ageDays: null };
    }

    const registeredAt = new Date(registration.eventDate);
    const ageDays = Math.floor(
      (Date.now() - registeredAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return { available: true, registeredAt, ageDays };
  } catch {
    return { available: false, registeredAt: null, ageDays: null };
  }
}

export function isNewlyRegistered(ageDays: number | null): boolean {
  return ageDays !== null && ageDays < NEW_DOMAIN_THRESHOLD_DAYS;
}
