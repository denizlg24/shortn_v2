import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";
import { polarClient } from "@polar-sh/better-auth";
import { CustomerStateSubscription } from "@polar-sh/sdk/models/components/customerstatesubscription.js";
export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    polarClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});

export type ClientSession = typeof authClient.$Infer.Session;
export type ClientUser = (typeof authClient.$Infer.Session)["user"];

export async function getClientSession() {
  return authClient.getSession();
}

export function getPlanFromSubscription({
  subscriptions,
}: {
  subscriptions: CustomerStateSubscription[];
}) {
  if (subscriptions.length === 0) return "free";
  const subscription = subscriptions.filter(
    (sub) => sub.status === "active" || sub.status === "trialing",
  )[0];
  if (!subscription) return "free";
  return subscription.metadata?.plan || "free";
}
