import env from "@/utils/env";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins/username";
import { sendRecoveryEmail } from "@/app/actions/userActions";
import { sendEmail } from "@/app/actions/sendEmail";
import {
  verificationEmailTemplate,
  emailVerifiedTemplate,
  updateEmailVerificationTemplate,
  confirmEmailChangeTemplate,
} from "@/lib/email-templates";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { subscribeToFreePlan } from "@/app/actions/stripeActions";
import { BASEURL } from "./utils";
import { connectDB } from "./mongodb";
import { Subscription } from "@/models/auth/Subscription";
import { Session } from "@/models/auth/Session";

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
  baseURL: BASEURL,
  database: mongodbAdapter(db, {
    client,
  }),
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, token }) => {
        const verifyUrl = `${BASEURL}/${"en"}/verify/request-change?token=${token}&email=${user.email}&new=${newEmail}`;
        await sendEmail({
          from: "no-reply@shortn.at",
          to: user.email,
          subject: "Shortn Account - Confirm your email change request",
          html: confirmEmailChangeTemplate({
            confirmLink: verifyUrl,
            userName: user.name || user.email,
            newEmail,
          }),
        });
      },
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
      update: {
        after: async (user, ctx) => {
          if (user.email !== ctx?.context.session?.user.email) {
            console.log(
              `Email changed for user ${user.id}. Revoking all sessions.`,
            );
            await Session.deleteMany({ userId: user.id });
          }
        },
      },
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
      await sendRecoveryEmail(user.email, url);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }, request) => {
      const verifyUrl = `${BASEURL}/${"en"}/verify?token=${token}`;
      if (request?.url?.includes("/verify-email")) {
        await sendEmail({
          from: "no-reply@shortn.at",
          to: user.email,
          subject: "Shortn account - Verify your new email address",
          html: updateEmailVerificationTemplate({
            verificationLink: verifyUrl,
            newEmail: user.email,
          }),
        });
      } else {
        await sendEmail({
          from: "no-reply@shortn.at",
          to: user.email,
          subject: "Welcome to Shortn! - Verify Your Email",
          html: verificationEmailTemplate({
            verificationLink: verifyUrl,
            userName: user.name || user.email,
          }),
        });
      }
    },
    onEmailVerification: async (user) => {
      await sendEmail({
        from: "no-reply@shortn.at",
        to: user.email,
        subject: "Shortn account - Email Verified Successfully!",
        html: emailVerifiedTemplate({
          userName: user.name,
          dashboardLink: `${BASEURL}/${"en"}/dashboard`,
        }),
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
          username:
            profile.login ||
            profile.email.substring(0, profile.email.indexOf("@")),
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
          name:
            [profile.given_name, profile.family_name].join(" ").trim() ||
            profile.name ||
            profile.email.substring(0, profile.email.indexOf("@")),
          username: profile.email.substring(0, profile.email.indexOf("@")),
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
      onCustomerCreate: async (data) => {
        const { user, stripeCustomer } = data;
        await connectDB();
        const subscription = await subscribeToFreePlan({
          customer_id: stripeCustomer.id,
          userId: user.id,
        });
        if (!subscription) {
          throw new Error("Failed to create subscription");
        }
        await Subscription.create({
          referenceId: user.id,
          plan: "free",
          status: "active",
          stripeCustomerId: stripeCustomer.id,
          stripeSubscriptionId: subscription.id,
          periodStart: new Date(subscription.start_date),
          periodEnd: new Date(
            subscription.start_date + 30 * 24 * 60 * 60 * 1000,
          ),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      },
      subscription: {
        enabled: true,
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
