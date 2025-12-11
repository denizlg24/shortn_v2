import env from "@/utils/env";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins/username";
import {
  sendRecoveryEmail,
  //sendUpdateEmailVerificationEmail,
  sendVerificationEmail,
} from "@/app/actions/userActions";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { subscribeToFreePlan } from "@/app/actions/stripeActions";
import { User } from "@/models/auth/User";
import { connectDB } from "./mongodb";

const generateRandomString = () => {
  const array = new Uint8Array(10);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
const client = new MongoClient(env.MONGODB_KEY);
const db = client.db();
export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    transaction: true,
  }),
  user: {
    changeEmail: {
      enabled: true,
      // sendChangeEmailConfirmation: async ({ user,newEmail, url }) => {
      //   void sendUpdateEmailVerificationEmail(user.email, url,newEmail);
      // },
    },
    additionalFields: {
      sub: {
        type: "string",
        defaultValue: null,
        index: true,
        unique: true,
        input: false,
      },
      links_this_month: { type: "number", defaultValue: 0, input: false },
      qr_codes_this_month: { type: "number", defaultValue: 0, input: false },
      redirects_this_month: { type: "number", defaultValue: 0, input: false },
      qr_code_redirects_this_month: {
        type: "number",
        defaultValue: 0,
        input: false,
      },
      stripeCustomerId: { type: "string", defaultValue: null, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              sub: user.sub || `authS|${generateRandomString()}`,
              image:
                user.image ||
                `https://robohash.org/${encodeURIComponent(user.email)}`,
            },
          };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,

    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }, _request) => {
      void sendRecoveryEmail(user.email, url);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, _request) => {
      void sendVerificationEmail(user.email, url);
    },
    onEmailVerification: async (user) => {
      await connectDB();
      const dbUser = await User.findById(user.id).lean();
      const stripeCustomerId = dbUser?.stripeCustomerId;
      if (!stripeCustomerId) {
        console.log("No stripe attached at the time of verification.");
        return;
      }
      await subscribeToFreePlan({
        customer_id: stripeCustomerId,
        userId: user.id,
      });
    },
  },

  socialProviders: {
    github: {
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      mapProfileToUser: (profile) => {
        return {
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          emailVerified: true,
          sub: `github|${profile.id}`,
        };
      },
    },
    google: {
      prompt: "select_account",
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      mapProfileToUser: (profile) => {
        return {
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified,
          sub: `google|${profile.sub}`,
        };
      },
    },
  },
  plugins: [
    username({
      maxUsernameLength: 100,
      minUsernameLength: 8,
      usernameValidator(username) {
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        return usernameRegex.test(username);
      },
      displayUsernameValidator(displayUsername) {
        const displayUsernameRegex = /^[a-zA-Z0-9 _.-]+$/;
        return (
          displayUsernameRegex.test(displayUsername) &&
          displayUsername.trim().length >= 3
        );
      },
    }),
    stripe({
      schema: {
        subscription: {
          modelName: "subscription",
        },
      },
      stripeClient,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        onSubscriptionComplete: async ({
          event,
          subscription,
          stripeSubscription,
          plan,
        }) => {
          console.log("Subscription complete:", {
            event,
            subscription,
            stripeSubscription,
            plan,
          });
        },
        plans: [
          {
            name: "free",
            priceId: env.FREE_PLAN_ID,
            limits: {
              links: 3,
              custom_back_half: 0,
              link_redirects: 0,
              codes: 3,
              code_redirects: 0,
              code_logo: 0,
              click_count: 0,
              scan_count: 0,
              time_date_analytics: 0,
              city_level_analytics: 0,
              device_os_browser_analytics: 0,
              referer_date: 0,
              export_clicks: 0,
              bioPages: 0,
            },
          },
          {
            name: "basic",
            priceId: env.BASIC_PLAN_ID,
            limits: {
              links: 25,
              custom_back_half: 0,
              link_redirects: 0,
              codes: 25,
              code_redirects: 0,
              code_logo: 0,
              click_count: 1,
              scan_count: 1,
              time_date_analytics: 0,
              city_level_analytics: 0,
              device_os_browser_analytics: 0,
              referer_date: 0,
              export_clicks: 0,
              bioPages: 0,
            },
          },
          {
            name: "plus",
            priceId: env.PLUS_PLAN_ID,
            limits: {
              links: 50,
              custom_back_half: 0,
              link_redirects: 10,
              codes: 50,
              code_redirects: 10,
              code_logo: 0,
              click_count: 1,
              scan_count: 1,
              time_date_analytics: 1,
              city_level_analytics: 1,
              device_os_browser_analytics: 1,
              referer_date: 0,
              export_clicks: 0,
              bioPages: 0,
            },
          },
          {
            name: "pro",
            priceId: env.PRO_PLAN_ID,
            limits: {
              links: "unlimited",
              custom_back_half: 1,
              link_redirects: "unlimited",
              codes: "unlimited",
              code_redirects: "unlimited",
              code_logo: 1,
              click_count: 1,
              scan_count: 1,
              time_date_analytics: 1,
              city_level_analytics: 1,
              device_os_browser_analytics: 1,
              referer_date: 1,
              export_clicks: 1,
              bioPages: 1,
            },
          },
        ],
      },
    }),
    nextCookies(),
  ],
});

export type ServerSession = typeof auth.$Infer.Session;
export type ServerUser = (typeof auth.$Infer.Session)["user"];
