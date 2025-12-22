/**
 * In-memory rate limiting implementation for password verification
 * This is a simple, free solution that doesn't require external APIs
 */

interface RateLimitEntry {
  attempts: number;
  resetTime: number;
}

class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;

    // Start cleanup interval to prevent memory leaks
    this.startCleanup();
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - Unique identifier for the request (e.g., IP address or urlCode)
   * @returns Object with success status and remaining attempts
   */
  check(identifier: string): {
    success: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    // If no entry exists or the window has expired, allow the request
    if (!entry || now >= entry.resetTime) {
      this.attempts.set(identifier, {
        attempts: 1,
        resetTime: now + this.windowMs,
      });

      return {
        success: true,
        remaining: this.maxAttempts - 1,
        resetTime: now + this.windowMs,
      };
    }

    // If under the limit, increment and allow
    if (entry.attempts < this.maxAttempts) {
      entry.attempts++;
      this.attempts.set(identifier, entry);

      return {
        success: true,
        remaining: this.maxAttempts - entry.attempts,
        resetTime: entry.resetTime,
      };
    }

    // Over the limit, deny the request
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset the rate limit for a specific identifier
   * Useful for clearing attempts after successful authentication
   */
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      if (now >= entry.resetTime) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Ensure cleanup doesn't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop the cleanup interval (for testing or shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create a singleton instance for password verification
// 5 attempts per 15 minutes
export const passwordRateLimiter = new RateLimiter(5, 15 * 60 * 1000);

export default RateLimiter;
