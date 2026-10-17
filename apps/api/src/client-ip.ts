import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** Direct deployments use the socket peer; proxied deployments require edge proof. */
export function clientIp(
  request: Request,
  peer: string | undefined,
  edgeSecret: string | undefined,
): string | undefined {
  if (!edgeSecret) return peer;
  const supplied = Buffer.from(request.headers.get("x-shortn-api-auth") ?? "");
  const expected = Buffer.from(edgeSecret);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return undefined;
  const ip = request.headers.get("x-shortn-client-ip");
  return ip && isIP(ip) ? ip : undefined;
}
