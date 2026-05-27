import { SignJWT, jwtVerify } from "jose";
import env from "@/utils/env";

const SECRET_KEY = new TextEncoder().encode(env.AUTH_SECRET);
const PURPOSE = "link-confirmation";
const TOKEN_TTL = "5m";

/**
 * Issues a short-lived, signed token that authorizes bypassing the
 * interstitial for a single slug. Replaces the previous `?c=1` flag, which any
 * crawler could forge to skip the safety page.
 */
export async function createConfirmationToken(slug: string): Promise<string> {
  return new SignJWT({ slug, purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(SECRET_KEY);
}

export async function verifyConfirmationToken(
  token: string,
  slug: string,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload.purpose === PURPOSE && payload.slug === slug;
  } catch {
    return false;
  }
}
