import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins";
import { stripeClient } from "@better-auth/stripe/client";
import type { auth } from "@/lib/auth";
export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    stripeClient({
      subscription: true,
    }),
    inferAdditionalFields<typeof auth>(),
  ],
});

export type ClientSession = typeof authClient.$Infer.Session;
export type ClientUser = (typeof authClient.$Infer.Session)["user"];

export async function getClientSession() {
  return authClient.getSession();
}

export async function getClientSubscription() {
  const { data, error } = await authClient.subscription.list();
  if (error || !data) {
    return "free";
  }
  const active = data.filter((sub) => sub.status === "active");
  if (active.length > 0) {
    return active[0].plan;
  }
  return "free";
}
