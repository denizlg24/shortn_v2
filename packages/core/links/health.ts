import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Documents } from "@shortn/db";
import { ruleDestinations } from "./rules";

export function healthTargets(url: string, rules?: unknown): string[] {
  let extra: string[] = [];
  try {
    extra = ruleDestinations(rules);
  } catch {
    /* Invalid legacy rule sets still allow a primary-URL health check. */
  }
  const targets = [url, ...extra];
  return [
    ...new Set(
      targets.map((value) => {
        try {
          const url = new URL(value);
          url.hash = "";
          return url.toString();
        } catch {
          return value;
        }
      }),
    ),
  ].sort();
}
export const healthSignature = (url: string, rules?: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(healthTargets(url, rules)))
    .digest("hex");
export function requestHealthCheck(
  url: string,
  rules?: unknown,
  now = new Date(),
) {
  return {
    generation: randomUUID(),
    signature: healthSignature(url, rules),
    iteration: 0,
    targets: healthTargets(url, rules),
    remaining: healthTargets(url, rules),
    checks: [],
    nextAt: now,
    attempts: 0,
  };
}
export const linkHealthViewSchema = z.object({
  flagged: z.boolean(),
  checkedAt: z.iso.datetime().nullable(),
  nextCheckAt: z.iso.datetime(),
  checks: z.array(
    z.object({
      url: z.string(),
      status: z.enum(["ok", "http_error", "unreachable", "blocked"]),
      httpStatus: z.number().int().min(100).max(599).nullable(),
      checkedAt: z.iso.datetime(),
      streak: z.number().int().nonnegative(),
      failingSince: z.iso.datetime().nullable(),
      error: z.string().nullable(),
    }),
  ),
});
export type LinkHealthView = z.infer<typeof linkHealthViewSchema>;
export function linkHealthView(
  link: Pick<Documents["links"], "health" | "longUrl" | "rules">,
): LinkHealthView | undefined {
  const health = link.health;
  if (
    !health ||
    !link.longUrl ||
    health.signature !== healthSignature(link.longUrl, link.rules)
  )
    return undefined;
  return {
    flagged: health.checks.some(
      (check) => check.status === "http_error" && check.streak >= 2,
    ),
    checkedAt: health.completedAt?.toISOString() ?? null,
    nextCheckAt: health.nextAt.toISOString(),
    checks: health.checks.map((check) => ({
      url: check.url,
      status: check.status,
      httpStatus: check.httpStatus ?? null,
      checkedAt: check.checkedAt.toISOString(),
      streak: check.streak,
      failingSince: check.failingSince?.toISOString() ?? null,
      error: check.error ?? null,
    })),
  };
}
