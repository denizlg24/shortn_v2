import { findAccountSuspension, physicalNames } from "@shortn/db";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { Db } from "mongodb";
import { createHash } from "node:crypto";
import { z } from "zod";

// Session handoff from legacy shortn.at to app.shortn.at (05). Cookies don't
// cross hosts, so legacy stores a one-time token (hashed, 60 s TTL) for the
// signed-in user and redirects here; this endpoint trades it for a session.

interface HandoffToken {
  _id: string;
  userId: string;
  impersonatedBy?: string;
  // Absent means read-only: legacy and older tokens never carry it.
  impersonationMode?: "read" | "write";
  expiresAt: Date;
}

export const hashHandoffToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// Only same-app relative paths, so the endpoint can't be an open redirect.
export const safeNext = (next: string | undefined) =>
  next && /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : "/";

export const handoff = (options: { db: () => Db }) =>
  ({
    id: "shortn-handoff",
    endpoints: {
      handoff: createAuthEndpoint(
        "/handoff",
        {
          method: "GET",
          query: z.object({
            t: z.string().min(16).max(256),
            next: z.string().max(512).optional(),
          }),
        },
        async (ctx) => {
          const next = safeNext(ctx.query.next);
          const found = await options
            .db()
            .collection<HandoffToken>(physicalNames.handoff_tokens)
            .findOneAndDelete({
              _id: hashHandoffToken(ctx.query.t),
              expiresAt: { $gt: new Date() },
            });
          if (!found)
            throw ctx.redirect(`/login?next=${encodeURIComponent(next)}`);
          const user = await ctx.context.internalAdapter.findUserById(
            found.userId,
          );
          if (!user) throw ctx.redirect("/login");
          // createSession's hook would refuse too, but only after the 2FA
          // step and as JSON; a navigation needs the login page.
          if (await findAccountSuspension(options.db(), user.id))
            throw ctx.redirect("/login?error=ACCOUNT_SUSPENDED");
          // Staff accounts are never impersonated (23 §3.6); the admin
          // action refuses first, this holds if a token is minted elsewhere.
          const role: unknown = Reflect.get(user, "role");
          if (
            found.impersonatedBy &&
            (role === "admin" || role === "superadmin")
          )
            throw ctx.redirect("/login");
          if (Reflect.get(user, "twoFactorEnabled") && !found.impersonatedBy) {
            // The one-time handoff proves the primary session only. Complete
            // the second factor on this host before creating any full session.
            const identifier = `2fa-${crypto.randomUUID()}`;
            const maxAge = 600;
            const expiresAt = new Date(Date.now() + maxAge * 1000);
            await ctx.context.internalAdapter.createVerificationValue({
              identifier,
              value: user.id,
              expiresAt,
            });
            await ctx.context.internalAdapter.createVerificationValue({
              identifier: `2fa-attempts-${identifier}`,
              value: "0",
              expiresAt,
            });
            const cookie = ctx.context.createAuthCookie("two_factor", {
              maxAge,
            });
            await ctx.setSignedCookie(
              cookie.name,
              identifier,
              ctx.context.secret,
              cookie.attributes,
            );
            throw ctx.redirect(
              `/login/two-factor?next=${encodeURIComponent(next)}`,
            );
          }
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
            false,
            found.impersonatedBy
              ? {
                  impersonatedBy: found.impersonatedBy,
                  impersonationMode:
                    found.impersonationMode === "write" ? "write" : "read",
                  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                }
              : undefined,
            true,
          );
          if (!session) throw ctx.redirect("/login");
          await setSessionCookie(ctx, { session, user });
          throw ctx.redirect(next);
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
