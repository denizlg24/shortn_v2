import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import env from "@/utils/env";
import { BASEURL } from "./utils";

interface ImpersonationClaims {
  userId: string;
  adminId: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env.INTERNAL_API_SECRET)
    .update(payload)
    .digest("base64url");
}

/**
 * Verifies a short-lived HMAC token minted by the admin app
 * (lib/impersonation.ts). Format: base64url(json).signature
 */
function verifyToken(token: string): ImpersonationClaims | null {
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
    if (!claims.userId || !claims.adminId || claims.exp < Date.now()) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

const DASHBOARD = `${BASEURL}/en/dashboard`;

/**
 * Exposes GET /api/auth/impersonate-handoff. The admin console redirects an
 * administrator here with a signed, single-use token; this mints a real user
 * session stamped with `impersonatedBy` and drops the user into the dashboard.
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
          const claims = verifyToken(ctx.query.token);
          if (!claims) {
            throw ctx.redirect(`${DASHBOARD}?impersonation=invalid`);
          }

          const targetUser = await ctx.context.internalAdapter.findUserById(
            claims.userId,
          );
          if (!targetUser) {
            throw ctx.redirect(`${DASHBOARD}?impersonation=notfound`);
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

          await setSessionCookie(ctx, { session, user: targetUser }, true);
          throw ctx.redirect(`${DASHBOARD}?impersonating=1`);
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
