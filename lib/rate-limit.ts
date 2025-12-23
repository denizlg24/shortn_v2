import RateLimit from "@/models/RateLimit";
import { connectDB } from "./mongodb";

interface RateLimitResult {
  allowed: boolean;
  attemptsRemaining: number;
  resetTime?: Date;
  blockedUntil?: Date;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 60 * 60 * 1000,
};

/**
 * Check and update rate limit for a given identifier
 * @param identifier - Unique identifier (e.g., IP + urlCode)
 * @param config - Rate limit configuration
 * @returns RateLimitResult indicating if request is allowed
 */
export async function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {},
): Promise<RateLimitResult> {
  await connectDB();

  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const now = new Date();

  let rateLimitDoc = await RateLimit.findOne({ identifier });

  if (!rateLimitDoc) {
    rateLimitDoc = await RateLimit.create({
      identifier,
      attempts: 1,
      lastAttempt: now,
    });

    return {
      allowed: true,
      attemptsRemaining: finalConfig.maxAttempts - 1,
    };
  }

  if (rateLimitDoc.blockedUntil && rateLimitDoc.blockedUntil > now) {
    return {
      allowed: false,
      attemptsRemaining: 0,
      blockedUntil: rateLimitDoc.blockedUntil,
    };
  }

  const windowExpired =
    now.getTime() - rateLimitDoc.lastAttempt.getTime() > finalConfig.windowMs;

  if (windowExpired) {
    rateLimitDoc.attempts = 1;
    rateLimitDoc.lastAttempt = now;
    rateLimitDoc.blockedUntil = undefined;
    await rateLimitDoc.save();

    return {
      allowed: true,
      attemptsRemaining: finalConfig.maxAttempts - 1,
    };
  }

  rateLimitDoc.attempts += 1;
  rateLimitDoc.lastAttempt = now;

  if (rateLimitDoc.attempts > finalConfig.maxAttempts) {
    rateLimitDoc.blockedUntil = new Date(
      now.getTime() + finalConfig.blockDurationMs,
    );
    await rateLimitDoc.save();

    return {
      allowed: false,
      attemptsRemaining: 0,
      blockedUntil: rateLimitDoc.blockedUntil,
    };
  }

  await rateLimitDoc.save();

  return {
    allowed: true,
    attemptsRemaining: finalConfig.maxAttempts - rateLimitDoc.attempts,
  };
}

/**
 * Reset rate limit for a given identifier (e.g., after successful authentication)
 * @param identifier - Unique identifier
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  await connectDB();
  await RateLimit.deleteOne({ identifier });
}

/**
 * Get client IP address from request headers
 * @param request - Next.js request object
 * @returns IP address string
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return "unknown";
}

/**
 * Format time remaining until unblock
 * @param blockedUntil - Date when user will be unblocked
 * @returns Human-readable string
 */
export function formatBlockedTime(blockedUntil: Date): string {
  const now = new Date();
  const diff = blockedUntil.getTime() - now.getTime();

  if (diff <= 0) return "now";

  const minutes = Math.ceil(diff / (60 * 1000));

  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours > 1 ? "s" : ""}`;
}
