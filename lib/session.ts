import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Gets the current session from Better-Auth
 * Returns null if no session exists
 */
export async function getServerSession() {
  try {
    const session = auth.api.getSession({ headers: await headers() });

    return session;
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
