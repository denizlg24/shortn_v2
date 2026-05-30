import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import env from "@/utils/env";
import { BASEURL } from "./utils";
import { connectDB } from "./mongodb";
import { ImpersonationNonce } from "@/models/auth/ImpersonationNonce";
import { ImpersonationBackref } from "@/models/auth/ImpersonationBackref";

interface ImpersonationClaims {
  userId: string;
  adminId: string;
  exp: number;
  jti: string;
}

function sign(payload: string): string {
  return createHmac("sha256", env.INTERNAL_API_SECRET)
    .update(payload)
    .digest("base64url");
}

/**
 * Verifies a short-lived HMAC token minted by the admin app
 * and atomically checks/consumes the nonce to enforce single-use.
 * Format: base64url(json).signature
 */
async function verifyToken(token: string): Promise<ImpersonationClaims | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ImpersonationClaims;

    // Validate all required claims
    if (
      !claims.userId ||
      !claims.adminId ||
      !claims.jti ||
      claims.exp < Date.now()
    ) {
      return null;
    }

    // Atomically check and consume the nonce to prevent replay attacks
    await connectDB();

    const nonce = await ImpersonationNonce.findOne({ jti: claims.jti });

    // Reject if nonce doesn't exist, already consumed, or expired
    if (!nonce) {
      return null;
    }

    if (nonce.consumedAt) {
      console.warn(
        `Replay attack detected: jti=${claims.jti} already consumed at ${nonce.consumedAt}`,
      );
      return null;
    }

    if (nonce.expiresAt < new Date()) {
      return null;
    }

    // Verify nonce matches claims
    if (nonce.adminId !== claims.adminId || nonce.userId !== claims.userId) {
      return null;
    }

    // Mark nonce as consumed atomically
    const updated = await ImpersonationNonce.findOneAndUpdate(
      { jti: claims.jti, consumedAt: { $exists: false } },
      { $set: { consumedAt: new Date() } },
      { new: true },
    );

    if (!updated) {
      console.warn(
        `Race condition: jti=${claims.jti} was consumed by another request`,
      );
      return null;
    }

    return claims;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

const DASHBOARD = `${BASEURL}/en/dashboard`;

/**
 * Exposes GET /api/auth/impersonate-handoff. The admin console redirects an
 * administrator here with a signed, single-use token; this mints a real user
 * session stamped with `impersonatedBy` and drops the user into the dashboard.
 *
 * Security: Token is single-use enforced via nonce consumption. Admin's original
 * session is persisted for later restoration.
 */
export const impersonationHandoff = () =>
  ({
    id: "impersonation-handoff",
    endpoints: {
      impersonateHandoff: createAuthEndpoint(
        "/impersonate-handoff",
        {
          method: "GET",
          query: z.object({ token: z.string().min(1) }),
        },
        async (ctx) => {
          const claims = await verifyToken(ctx.query.token);
          if (!claims) {
            throw ctx.redirect(`${DASHBOARD}?impersonation=invalid`);
          }

          const targetUser = await ctx.context.internalAdapter.findUserById(
            claims.userId,
          );
          if (!targetUser) {
            throw ctx.redirect(`${DASHBOARD}?impersonation=notfound`);
          }

          // Persist admin's original session before overwriting
          let adminSessionToken: string | null = null;
          try {
            const currentSession =
              await ctx.context.internalAdapter.findSession(
                ctx.headers?.get("cookie") ?? "",
              );
            if (currentSession?.session?.userId === claims.adminId) {
              adminSessionToken = currentSession.session.token;
            }
          } catch (error) {
            console.warn(
              "Could not retrieve admin session for preservation:",
              error,
            );
          }

          const session = await ctx.context.internalAdapter.createSession(
            targetUser.id,
            true,
            {
              impersonatedBy: claims.adminId,
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
            true,
          );
          if (!session) {
            throw ctx.redirect(`${DASHBOARD}?impersonation=failed`);
          }

          // Store backref to allow session restoration
          if (adminSessionToken) {
            await connectDB();
            await ImpersonationBackref.create({
              adminId: claims.adminId,
              adminSessionToken: adminSessionToken,
              impersonatedUserId: claims.userId,
              impersonatedSessionToken: session.token,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            });
          }

          await setSessionCookie(ctx, { session, user: targetUser }, true);
          throw ctx.redirect(`${DASHBOARD}?impersonating=1`);
        },
      ),
      stopImpersonation: createAuthEndpoint(
        "/stop-impersonation",
        {
          method: "POST",
        },
        async (ctx) => {
          // Get current session
          const currentSession = await ctx.context.internalAdapter.findSession(
            ctx.headers?.get("cookie") ?? "",
          );

          if (!currentSession?.session) {
            return ctx.json(
              { success: false, error: "No active session" },
              { status: 401 },
            );
          }

          const impersonatedSessionToken = currentSession.session.token;

          // Find the backref to restore admin session
          await connectDB();
          const backref = await ImpersonationBackref.findOne({
            impersonatedSessionToken,
          });

          if (!backref) {
            // No backref found - just sign out
            await ctx.context.internalAdapter.deleteSession(
              impersonatedSessionToken,
            );
            return ctx.json({ success: true, restored: false });
          }

          // Verify the admin session still exists (findSession returns both
          // the session and its user, keyed by the stored session token)
          const adminSession = await ctx.context.internalAdapter.findSession(
            backref.adminSessionToken,
          );

          if (!adminSession?.session || !adminSession.user) {
            // Admin session expired - clean up and sign out
            await ctx.context.internalAdapter.deleteSession(
              impersonatedSessionToken,
            );
            await ImpersonationBackref.deleteOne({ _id: backref._id });
            return ctx.json({ success: true, restored: false });
          }

          // Delete impersonated session
          await ctx.context.internalAdapter.deleteSession(
            impersonatedSessionToken,
          );

          // Restore admin session
          await setSessionCookie(
            ctx,
            { session: adminSession.session, user: adminSession.user },
            true,
          );

          // Clean up backref
          await ImpersonationBackref.deleteOne({ _id: backref._id });

          return ctx.json({ success: true, restored: true });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
