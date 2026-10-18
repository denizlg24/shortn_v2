import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

function proven(supplied: string | null, secret: string | undefined) {
  if (!secret || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Behind the edge Worker (or the redirect's custom-domain proxy) the
 * CF-Connecting-IP header is the proxy's egress address, so the visitor
 * address arrives in x-shortn-client-ip — trusted only with a proof.
 */
export function visitorIp(
  headers: HeaderReader,
  secrets: { edge?: string | undefined; bio?: string | undefined },
): string {
  const forwarded =
    proven(headers.get("x-shortn-web-auth"), secrets.edge) ||
    proven(headers.get("x-bio-auth"), secrets.bio)
      ? headers.get("x-shortn-client-ip")
      : null;
  if (forwarded && isIP(forwarded)) return forwarded;
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
