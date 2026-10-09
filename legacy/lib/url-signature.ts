import crypto from "crypto";
import env from "@/utils/env";

/**
 * Signs a subscription ID with HMAC-SHA256 for secure URL transmission
 */
export function signSubscriptionId(subscriptionId: string): string {
  const hmac = crypto.createHmac("sha256", env.AUTH_SECRET);
  hmac.update(subscriptionId);
  return hmac.digest("hex");
}

/**
 * Verifies a subscription ID signature
 */
export function verifySubscriptionId(
  subscriptionId: string,
  signature: string,
): boolean {
  const expectedSignature = signSubscriptionId(subscriptionId);
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );
}
