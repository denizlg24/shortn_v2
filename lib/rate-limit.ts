import RateLimit from "@/models/RateLimit";
import { connectDB } from "./mongodb";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { headers } from "next/headers";

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

export const RATE_LIMIT_PRESETS = {
  auth: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 60 * 60 * 1000,
  },

  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  },

  sensitive: {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 30 * 60 * 1000,
  },

  contact: {
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
    blockDurationMs: 24 * 60 * 60 * 1000,
  },

  fetch: {
    maxAttempts: 200,
    windowMs: 60 * 1000,
    blockDurationMs: 60 * 1000,
  },
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMIT_PRESETS;

/**
 * Authentication result for route handlers
 */
export interface AuthResult {
  authenticated: boolean;
  user?: {
    id: string;
    sub: string;
    email: string;
    name?: string;
    [key: string]: unknown;
  };
  session?: {
    id: string;
    userId: string;
    expiresAt: Date;
    [key: string]: unknown;
  };
}

/**
 * Check if request is authenticated
 * Use this in API routes that need auth protection
 */
export async function checkAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: session.user as AuthResult["user"],
      session: session.session as AuthResult["session"],
    };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Check if request is authenticated using headers() for server components
 */
export async function checkAuthFromHeaders(): Promise<AuthResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: session.user as AuthResult["user"],
      session: session.session as AuthResult["session"],
    };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Combined auth and rate limit check for API routes
 * Returns appropriate error responses or null if checks pass
 */
export async function protectRoute(
  request: NextRequest,
  options: {
    requireAuth?: boolean;
    rateLimit?: {
      identifier: string;
      preset?: RateLimitPreset;
      config?: Partial<RateLimitConfig>;
    };
  },
): Promise<{
  error: NextResponse | null;
  auth: AuthResult;
  rateLimit: RateLimitResult | null;
}> {
  let authResult: AuthResult = { authenticated: false };
  let rateLimitResult: RateLimitResult | null = null;

  if (options.requireAuth) {
    authResult = await checkAuth(request);
    if (!authResult.authenticated) {
      return {
        error: NextResponse.json(
          { success: false, message: "Unauthorized" },
          { status: 401 },
        ),
        auth: authResult,
        rateLimit: null,
      };
    }
  }

  if (options.rateLimit) {
    const config = options.rateLimit.preset
      ? RATE_LIMIT_PRESETS[options.rateLimit.preset]
      : options.rateLimit.config || DEFAULT_CONFIG;

    rateLimitResult = await checkRateLimit(
      options.rateLimit.identifier,
      config,
    );

    if (!rateLimitResult.allowed) {
      const timeRemaining = rateLimitResult.blockedUntil
        ? formatBlockedTime(rateLimitResult.blockedUntil)
        : "some time";

      return {
        error: NextResponse.json(
          {
            success: false,
            message: `Too many requests. Please try again in ${timeRemaining}.`,
            blockedUntil: rateLimitResult.blockedUntil,
          },
          { status: 429 },
        ),
        auth: authResult,
        rateLimit: rateLimitResult,
      };
    }
  }

  return {
    error: null,
    auth: authResult,
    rateLimit: rateLimitResult,
  };
}

/**
 * Create a rate limit identifier for an API route
 */
export function createRateLimitIdentifier(
  prefix: string,
  request: NextRequest,
  options?: {
    includeUserId?: string;
    includeParam?: string;
  },
): string {
  const ip = getClientIp(request);
  let identifier = `${prefix}:${ip}`;

  if (options?.includeUserId) {
    identifier += `:${options.includeUserId}`;
  }

  if (options?.includeParam) {
    identifier += `:${options.includeParam}`;
  }

  return identifier;
}

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
    await RateLimit.findOneAndUpdate(
      { identifier },
      { $set: { attempts: 1, lastAttempt: now }, $unset: { blockedUntil: "" } },
    );

    return {
      allowed: true,
      attemptsRemaining: finalConfig.maxAttempts - 1,
    };
  }

  const newAttempts = rateLimitDoc.attempts + 1;

  if (newAttempts > finalConfig.maxAttempts) {
    const newBlockedUntil = new Date(
      now.getTime() + finalConfig.blockDurationMs,
    );

    await RateLimit.findOneAndUpdate(
      { identifier },
      {
        $set: {
          attempts: newAttempts,
          lastAttempt: now,
          blockedUntil: newBlockedUntil,
        },
      },
    );

    return {
      allowed: false,
      attemptsRemaining: 0,
      blockedUntil: newBlockedUntil,
    };
  }

  await RateLimit.findOneAndUpdate(
    { identifier },
    { $set: { attempts: newAttempts, lastAttempt: now } },
  );

  return {
    allowed: true,
    attemptsRemaining: finalConfig.maxAttempts - newAttempts,
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
