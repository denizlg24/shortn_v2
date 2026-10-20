import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";

// Account security and identity stay out of reach of an impersonating
// staff member in either mode (23 §3.6). The two-factor, passkey and SSO
// plugins also refuse impersonation; this holds even if one forgets.
// OAuth and MCP grants are blocked whole: the provider skips the consent
// screen when a grant already exists, so blocking consent alone isn't enough.
const exact = new Set([
  "/change-password",
  "/change-email",
  "/set-password",
  "/delete-user",
  "/revoke-other-sessions",
  "/revoke-sessions",
  "/link-social",
  "/unlink-account",
]);
const prefixes = [
  "/two-factor/",
  "/passkey/",
  "/sso/",
  "/api-key",
  "/oauth2/",
  "/mcp/",
  // Polar's customer portal: orders, subscriptions and the billing portal.
  "/customer/",
];

export const impersonationRestricted = (path: string) =>
  exact.has(path) || prefixes.some((prefix) => path.startsWith(prefix));

export function impersonationPolicy(): BetterAuthPlugin {
  return {
    id: "shortn-impersonation-policy",
    hooks: {
      before: [
        {
          matcher: (ctx) => impersonationRestricted(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (session && Reflect.get(session.session, "impersonatedBy"))
              throw new APIError("FORBIDDEN", {
                code: "IMPERSONATION_FORBIDDEN",
                message: "Not available while impersonating",
              });
          }),
        },
      ],
    },
  };
}
