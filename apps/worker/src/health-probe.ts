import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createHash } from "node:crypto";
import type { Redis } from "ioredis";
import { validateDestination } from "@shortn/core";
import { publicWebhookAddress, pinnedLookup } from "./webhook-sender";
export type HealthOutcome = {
  status: "ok" | "http_error" | "unreachable" | "blocked";
  httpStatus?: number;
  error?: string;
};
export type HealthProbeResult = HealthOutcome | { retryAfter: number };
type Resolve = (host: string) => Promise<{ address: string; family: number }[]>;
export const healthHostKey = (hostname: string) =>
  `health:host:${createHash("sha256").update(hostname.toLowerCase().replace(/\.+$/, "")).digest("hex")}`;
export async function reserveHealthHost(
  redis: Pick<Redis, "eval">,
  hostname: string,
) {
  const result = (await redis.eval(
    `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current > now + 2000 then return {-1, current - now} end
local start = math.max(current, now)
redis.call('SET', KEYS[1], start + 1000, 'PX', 10000)
return {start - now, 0}
`,
    1,
    healthHostKey(hostname),
  )) as [number, number];
  return result[0] < 0 ? { retryAfter: result[1] } : { wait: result[0] };
}
export class HealthRequestError extends Error {
  constructor(
    public code: "destination_rejected" | "timeout" | "network_error",
  ) {
    super(code);
  }
}
export class HealthRateLimitedError extends Error {
  constructor(public retryAfter: number) {
    super("rate_limited");
  }
}
class HealthInfrastructureError extends Error {}
export async function resolveHealthTarget(
  value: string,
  resolve: Resolve = (host) => lookup(host, { all: true }),
) {
  if (!validateDestination(value).ok)
    throw new HealthRequestError("destination_rejected");
  const url = new URL(value);
  if (url.username || url.password)
    throw new HealthRequestError("destination_rejected");
  url.hash = "";
  const addresses = await resolve(url.hostname);
  if (
    !addresses.length ||
    addresses.some((address) => !publicWebhookAddress(address.address))
  )
    throw new HealthRequestError("destination_rejected");
  return { url, address: addresses[0]! };
}
export async function healthRequest(
  value: string,
  method: "HEAD" | "GET",
  deps: {
    resolve?: Resolve;
    request?: typeof httpRequest;
    timeoutMs?: number;
    reserve?: (host: string) => Promise<{ wait?: number; retryAfter?: number }>;
    sleep?: (ms: number) => Promise<unknown>;
  } = {},
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = Date.now() + (deps.timeoutMs ?? 8000);
  try {
    const target = await Promise.race([
      resolveHealthTarget(value, deps.resolve),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new HealthRequestError("timeout")),
          Math.max(1, deadline - Date.now()),
        );
      }),
    ]);
    clearTimeout(timer);
    if (deps.reserve) {
      let reservation: { wait?: number; retryAfter?: number };
      try {
        reservation = await deps.reserve(target.url.hostname);
      } catch {
        throw new HealthInfrastructureError("rate_store_unavailable");
      }
      if (reservation.retryAfter !== undefined)
        throw new HealthRateLimitedError(reservation.retryAfter);
      if (Date.now() + (reservation.wait ?? 0) >= deadline)
        throw new HealthRequestError("timeout");
      if (reservation.wait) await (deps.sleep ?? Bun.sleep)(reservation.wait);
    }
    if (Date.now() >= deadline) throw new HealthRequestError("timeout");
    return await new Promise<{ status: number; location?: string }>(
      (resolve, reject) => {
        const request =
          deps.request ??
          (target.url.protocol === "https:" ? httpsRequest : httpRequest);
        const req = request(
          target.url,
          {
            method,
            agent: false,
            family: target.address.family,
            maxHeaderSize: 16384,
            headers: {
              "User-Agent": "Shortn-LinkHealth/1.0",
              Accept: "*/*",
              ...(method === "GET" ? { Range: "bytes=0-0" } : {}),
            },
            lookup: pinnedLookup(target.address),
          },
          (response) => {
            const result = {
              status: response.statusCode ?? 0,
              ...(response.headers.location
                ? { location: response.headers.location }
                : {}),
            };
            response.destroy();
            resolve(result);
          },
        );
        timer = setTimeout(
          () => {
            reject(new HealthRequestError("timeout"));
            req.destroy();
          },
          Math.max(1, deadline - Date.now()),
        );
        req.on("error", (error) =>
          reject(
            error instanceof HealthRequestError
              ? error
              : new HealthRequestError("network_error"),
          ),
        );
        req.end();
      },
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function probeHealth(
  value: string,
  deps: {
    reserve: (host: string) => Promise<{ wait?: number; retryAfter?: number }>;
    request?: typeof healthRequest;
    sleep?: (ms: number) => Promise<unknown>;
  },
): Promise<HealthProbeResult> {
  let url = value;
  const deadline = Date.now() + 45000;
  const request = deps.request ?? healthRequest;
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!validateDestination(url).ok)
      return { status: "blocked", error: "destination_rejected" };
    const parsed = new URL(url);
    if (parsed.username || parsed.password)
      return { status: "blocked", error: "destination_rejected" };
    let result: Awaited<ReturnType<typeof healthRequest>>;
    for (const method of ["HEAD", "GET"] as const) {
      try {
        result = await request(url, method, {
          timeoutMs: Math.max(1, Math.min(8000, deadline - Date.now())),
          reserve: deps.reserve,
          ...(deps.sleep ? { sleep: deps.sleep } : {}),
        });
      } catch (error) {
        if (error instanceof HealthInfrastructureError) throw error;
        if (error instanceof HealthRateLimitedError)
          return { retryAfter: error.retryAfter };
        return {
          status:
            error instanceof HealthRequestError &&
            error.code === "destination_rejected"
              ? "blocked"
              : "unreachable",
          error:
            error instanceof HealthRequestError ? error.code : "network_error",
        };
      }
      if (method === "HEAD" && [405, 501].includes(result.status)) continue;
      break;
    }
    if (
      [301, 302, 303, 307, 308].includes(result!.status) &&
      result!.location
    ) {
      try {
        url = new URL(result!.location, url).toString();
      } catch {
        return { status: "unreachable", error: "invalid_redirect" };
      }
      continue;
    }
    if (result!.status >= 400 && result!.status <= 599)
      return { status: "http_error", httpStatus: result!.status };
    if (result!.status >= 200 && result!.status < 400)
      return { status: "ok", httpStatus: result!.status };
    return { status: "unreachable", error: "invalid_response" };
  }
  return { status: "unreachable", error: "redirect_limit" };
}
