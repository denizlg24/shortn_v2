import { ssoClient } from "@better-auth/sso/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { polarClient } from "@polar-sh/better-auth";
import {
  inferAdditionalFields,
  usernameClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "./index";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  plugins: [
    ssoClient({ domainVerification: { enabled: true } }),
    passkeyClient(),
    twoFactorClient({
      onTwoFactorRedirect: async () => {
        if (typeof window !== "undefined")
          window.location.assign(`/login/two-factor${window.location.search}`);
      },
    }),
    usernameClient(),
    polarClient(),
    inferAdditionalFields<Auth>(),
    {
      id: "oauth-provider-client",
      fetchPlugins: oauthProviderClient().fetchPlugins,
    },
    {
      id: "shortn-oauth-username",
      fetchPlugins: [
        {
          id: "shortn-oauth-username-query",
          name: "Shortn OAuth username continuation",
          hooks: {
            async onRequest(ctx) {
              if (
                typeof window === "undefined" ||
                !String(ctx.url).endsWith("/sign-in/username")
              )
                return;
              const params = new URLSearchParams(window.location.search);
              if (!params.has("sig")) return;
              const query = new URLSearchParams();
              const signedNames = new Set(params.getAll("ba_param"));
              if (!signedNames.size) return;
              for (const [key, value] of params) {
                if (key === "sig" || key === "ba_param" || signedNames.has(key))
                  query.append(key, value);
              }
              const body: unknown =
                typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
              ctx.body = JSON.stringify({
                ...(body && typeof body === "object" ? body : {}),
                oauth_query: query.toString(),
              });
            },
          },
        },
      ],
    },
  ],
});
