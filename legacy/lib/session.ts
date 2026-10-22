import { auth, authDb } from "@/lib/auth";
import { cacheRedis } from "@/lib/link-cache";
import { endSuspendedSession } from "@shortn/db";
import { headers } from "next/headers";

/**
 * Gets the current session from Better-Auth
 * Returns null if no session exists, or if the account was banned or
 * scheduled for deletion after the session was opened (doc 23 §3.1).
 */
export async function getServerSession() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return session;
    return (await endSuspendedSession(authDb, await cacheRedis(), session))
      ? null
      : session;
  } catch (_error) {
    return null;
  }
}

/**
 * Requires authentication - throws if no session
 * Use this for protected routes/actions
 */
export async function requireAuth() {
  const session = await getServerSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

// Re-export types for convenience
export type { ServerSession, ServerUser } from "@/lib/auth";
