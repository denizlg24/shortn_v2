import { createHmac, timingSafeEqual } from "crypto";

const SECRET =
  process.env.REDIRECT_SECRET || "change-this-to-a-strong-env-variable";

export function signUrlData(
  longUrl: string,
  urlCode: string,
  expiryTimestamp: number,
): string {
  // We sign the destination, the code, and the time it expires
  const data = `${longUrl}:${urlCode}:${expiryTimestamp}`;
  return createHmac("sha256", SECRET).update(data).digest("hex");
}

export function verifyUrlData(
  longUrl: string,
  urlCode: string,
  expiryTimestamp: number,
  signature: string,
): boolean {
  const expectedSignature = signUrlData(longUrl, urlCode, expiryTimestamp);

  // Use timingSafeEqual to prevent timing attacks
  const source = Buffer.from(signature, "hex");
  const target = Buffer.from(expectedSignature, "hex");

  if (source.length !== target.length) return false;
  return timingSafeEqual(source, target);
}
