import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";

/** Legacy cannot mint a full password session for a user protected in the new app. */
export function legacyPasswordGate(
  enabled: (userId: string) => Promise<boolean>,
  validPasskey?: (id: string, userId: string) => Promise<boolean>,
  validSso?: (
    session: { ssoProviderId?: unknown; ssoWorkspaceId?: unknown },
    userId: string,
  ) => Promise<boolean>,
): BetterAuthPlugin {
  return {
    id: "shortn-legacy-password-factor-gate",
    schema: {
      session: {
        fields: {
          passkeyId: { type: "string", required: false, input: false },
          ssoProviderId: { type: "string", required: false, input: false },
          ssoWorkspaceId: { type: "string", required: false, input: false },
        },
      },
    },
    hooks: {
      after: [
        {
          matcher: (ctx) =>
            ["/sign-in/email", "/sign-in/username", "/get-session"].includes(
              ctx.path ?? "",
            ),
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.path === "/get-session") {
              const result = ctx.context.returned;
              if (!result || typeof result !== "object") return;
              const session: unknown = Reflect.get(result, "session");
              if (!session || typeof session !== "object") return;
              const id = Reflect.get(session, "passkeyId"),
                userId = Reflect.get(session, "userId");
              const sso = {
                ssoProviderId: Reflect.get(session, "ssoProviderId"),
                ssoWorkspaceId: Reflect.get(session, "ssoWorkspaceId"),
              };
              const invalidPasskey =
                id != null &&
                (!validPasskey ||
                  typeof id !== "string" ||
                  typeof userId !== "string" ||
                  !(await validPasskey(id, userId)));
              const invalidSso =
                (sso.ssoProviderId != null || sso.ssoWorkspaceId != null) &&
                (!validSso ||
                  typeof userId !== "string" ||
                  !(await validSso(sso, userId)));
              if (invalidPasskey || invalidSso) {
                const token = Reflect.get(session, "token");
                if (typeof token === "string")
                  await ctx.context.internalAdapter.deleteSession(token);
                deleteSessionCookie(ctx, true);
                return ctx.json(null);
              }
              return;
            }
            const data = ctx.context.newSession;
            if (!data || !(await enabled(data.user.id))) return;
            deleteSessionCookie(ctx, true);
            await ctx.context.internalAdapter.deleteSession(data.session.token);
            ctx.context.setNewSession(null);
            throw new APIError("FORBIDDEN", {
              code: "TWO_FACTOR_NEW_APP_REQUIRED",
              message:
                "Continue signing in on the new dashboard to verify your authenticator",
            });
          }),
        },
      ],
    },
  };
}
