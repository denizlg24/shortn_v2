import { randomUUID } from "node:crypto";

/** Persist with the rules mutation. Both past and future boundaries need a flush. */
export function requestRuleSchedule(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const times = [
    ...new Set(
      [raw.activeFrom ?? raw.startsAt, raw.expiresAt]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => new Date(value as Date | string).getTime())
        .filter(Number.isFinite),
    ),
  ].sort((a, b) => a - b);
  if (!times.length) return undefined;
  return {
    generation: randomUUID(),
    queued: false,
    nextAt: new Date(times[0]!),
    remaining: times.slice(1).map((time) => new Date(time)),
    attempts: 0,
  };
}
