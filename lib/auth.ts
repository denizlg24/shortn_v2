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
import { BASEURL } from "./utils";
import { connectDB } from "./mongodb";
import { Session } from "@/models/auth/Session";
import { geolocation } from "@vercel/functions";
import {
  checkout,
  polar,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";
import { polarClient } from "./polar";

const generateRandomString = () => {
  const array = new Uint8Array(10);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const client = new MongoClient(env.MONGODB_KEY);
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),
  advanced: {
    cookiePrefix: "shortn_auth_",
  },
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
      phone_number: {
        type: "string",
        defaultValue: null,
        input: true,
      },
      links_this_month: { type: "number", defaultValue: 0, input: false },
      qr_codes_this_month: { type: "number", defaultValue: 0, input: false },
      redirects_this_month: { type: "number", defaultValue: 0, input: false },
      qr_code_redirects_this_month: {
        type: "number",
        defaultValue: 0,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      update: {
        after: async (user, ctx) => {
          const emailChanged =
            ctx?.context.session?.user.email &&
            user.email !== ctx?.context.session?.user.email;

          const nameChanged =
            ctx?.context.session?.user.name &&
            user.name !== ctx?.context.session?.user.name;

          if (emailChanged || nameChanged) {
            if (emailChanged) {
              console.log(
                `Email changed for user ${user.id}. Revoking all sessions.`,
              );
              await connectDB();
              await Session.deleteMany({ userId: user.id });
            }
            try {
              console.log(
                `Updating Polar customer for user ${user.id} (sub: ${user.sub})`,
              );

              const customer = await polarClient.customers.getExternal({
                externalId: user.id,
              });

              if (customer) {
                const customerUpdate: { email?: string; name?: string } = {};

                if (emailChanged && user.email) {
                  customerUpdate.email = user.email;
                  console.log(
                    `Updating Polar customer email to: ${user.email}`,
                  );
                }

                if (nameChanged && user.name) {
                  customerUpdate.name = user.name;
                  console.log(`Updating Polar customer name to: ${user.name}`);
                }

                await polarClient.customers.update({
                  id: customer.id,
                  customerUpdate,
                });

                console.log(
                  `Successfully updated Polar customer ${customer.id}`,
                );
              } else {
                console.log(
                  `No Polar customer found for user ${user.id} (sub: ${user.sub})`,
                );
              }
            } catch (error) {
              console.error(
                `Failed to update Polar customer for user ${user.id}:`,
                error,
              );
            }
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
    session: {
      create: {
        before: async (session, ctx) => {
          const request = ctx?.request;
          let geo = null;

          if (request) {
            try {
              geo = geolocation(request);
            } catch (error) {
              console.error("Failed to get geolocation:", error);
            }
          }

          return {
            data: {
              ...session,
              geo: geo
                ? {
                    city: geo.city,
                    country: geo.country,
                    countryRegion: geo.countryRegion,
                    region: geo.region,
                    latitude: geo.latitude,
                    longitude: geo.longitude,
                  }
                : undefined,
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
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            {
              productId: env.PRO_PLAN_ID,
              slug: "pro",
            },
            {
              productId: env.PLUS_PLAN_ID,
              slug: "plus",
            },
            {
              productId: env.BASIC_PLAN_ID,
              slug: "basic",
            },
          ],
          successUrl: `${BASEURL}/dashboard/subscription/success?checkout_id={CHECKOUT_ID}`,
          authenticatedUsersOnly: true,
        }),
        portal({
          returnUrl: `${BASEURL}/dashboard/settings/plan`,
        }),
        usage(),
        webhooks({
          secret: env.POLAR_WEBHOOK_SECRET!,

          onSubscriptionCreated: async (payload) => {
            console.log("Subscription created:", payload.data.id);
            try {
              const { sendSubscriptionCreatedEmail } = await import(
                "@/lib/subscription-email-helpers"
              );
              const user = payload.data.customer;
              if (!user) return;

              await sendSubscriptionCreatedEmail({
                userEmail: user.email,
                userName: user.name || "User",
                planName: payload.data.product?.name || "Premium",
              });
            } catch (error) {
              console.error("Error sending subscription created email:", error);
            }
          },

          onSubscriptionActive: async (payload) => {
            console.log("Subscription active:", payload.data.id);

            try {
              const { connectDB } = await import("@/lib/mongodb");
              const ScheduledChange = (
                await import("@/models/subscription/ScheduledChange")
              ).default;

              await connectDB();

              const pendingDowngrade = await ScheduledChange.findOne({
                subscriptionId: payload.data.id,
                changeType: "downgrade",
                status: "pending",
              });

              if (pendingDowngrade) {
                const scheduledFor = new Date(pendingDowngrade.scheduledFor);
                const now = new Date();

                if (scheduledFor <= now) {
                  console.log(
                    `Executing pending downgrade for subscription ${payload.data.id}`,
                  );

                  try {
                    const targetProductId =
                      pendingDowngrade.targetPlan === "pro"
                        ? env.PRO_PLAN_ID
                        : pendingDowngrade.targetPlan === "plus"
                          ? env.PLUS_PLAN_ID
                          : pendingDowngrade.targetPlan === "basic"
                            ? env.BASIC_PLAN_ID
                            : null;

                    if (
                      targetProductId &&
                      payload.data.productId !== targetProductId
                    ) {
                      await polarClient.subscriptions.update({
                        id: payload.data.id,
                        subscriptionUpdate: {
                          productId: targetProductId,
                          prorationBehavior: "invoice",
                          cancelAtPeriodEnd: false,
                        },
                      });

                      await ScheduledChange.findByIdAndUpdate(
                        pendingDowngrade._id,
                        {
                          status: "executed",
                        },
                      );

                      console.log(
                        `Successfully executed downgrade to ${pendingDowngrade.targetPlan}`,
                      );
                    } else {
                      await ScheduledChange.findByIdAndUpdate(
                        pendingDowngrade._id,
                        {
                          status: "executed",
                        },
                      );
                      console.log(
                        `Subscription already on target product ${pendingDowngrade.targetPlan}`,
                      );
                    }
                  } catch (error) {
                    console.error("Error executing pending downgrade:", error);
                  }
                }
              }
            } catch (error) {
              console.error("Error checking for pending downgrades:", error);
            }

            try {
              const { sendSubscriptionActiveEmail } = await import(
                "@/lib/subscription-email-helpers"
              );
              const user = payload.data.customer;
              if (!user) return;

              await sendSubscriptionActiveEmail({
                userEmail: user.email,
                userName: user.name || "User",
                planName: payload.data.product?.name || "Premium",
                nextBillingDate: payload.data.currentPeriodEnd
                  ? new Date(payload.data.currentPeriodEnd)
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              });
            } catch (error) {
              console.error("Error sending subscription active email:", error);
            }
          },

          onSubscriptionCanceled: async (payload) => {
            console.log("Subscription canceled:", payload.data.id);
            try {
              const { sendSubscriptionCanceledEmail } = await import(
                "@/lib/subscription-email-helpers"
              );

              const user = payload.data.customer;
              if (!user) return;
              const { connectDB } = await import("@/lib/mongodb");
              const ScheduledChange = (
                await import("@/models/subscription/ScheduledChange")
              ).default;
              await connectDB();
              const existingScheduledChange =
                await ScheduledChange.findOneAndUpdate(
                  {
                    subscriptionId: payload.data.id,
                    status: "pending",
                    changeType: "downgrade",
                  },
                  { targetPlan: "free", changeType: "cancellation" },
                );
              if (
                existingScheduledChange &&
                existingScheduledChange.qstashMessageId
              ) {
                const { qstashClient } = await import("@/lib/qstash");
                await qstashClient.messages.delete(
                  existingScheduledChange.qstashMessageId,
                );
                console.log(
                  `Deleted QStash message: ${existingScheduledChange.qstashMessageId}`,
                );
              }
              const endDate =
                payload.data.currentPeriodEnd || payload.data.endedAt;

              if (!endDate) return;

              if (!existingScheduledChange && endDate > new Date()) {
                const scheduledChange = await ScheduledChange.create({
                  userId: user.externalId,
                  subscriptionId: payload.data.id,
                  changeType: "cancellation",
                  currentPlan:
                    payload.data.productId == env.PRO_PLAN_ID
                      ? "pro"
                      : payload.data.productId == env.PLUS_PLAN_ID
                        ? "plus"
                        : "basic",
                  targetPlan: "free",
                  scheduledFor: endDate,
                  reason: payload.data.customerCancellationReason,
                  comment: payload.data.customerCancellationComment || "",
                  status: "pending",
                });

                console.log(
                  `Created scheduled cancellation for subscription ${payload.data.id} with ID: ${scheduledChange._id}`,
                );
              }

              await sendSubscriptionCanceledEmail({
                userEmail: user.email,
                userName: user.name || "User",
                planName: payload.data.product?.name || "Premium",
                endDate: new Date(endDate),
              });
            } catch (error) {
              console.error(
                "Error sending subscription canceled email:",
                error,
              );
            }
          },

          onSubscriptionUncanceled: async (payload) => {
            console.log("Subscription uncanceled:", payload.data.id);

            try {
              const { connectDB } = await import("@/lib/mongodb");
              const ScheduledChange = (
                await import("@/models/subscription/ScheduledChange")
              ).default;
              const { qstashClient } = await import("@/lib/qstash");

              await connectDB();

              const pendingChange = await ScheduledChange.findOne({
                subscriptionId: payload.data.id,
                status: "pending",
              });

              if (pendingChange) {
                console.log(
                  `Found pending change to revert: ${pendingChange._id}`,
                );

                if (pendingChange.qstashMessageId) {
                  try {
                    await qstashClient.messages.delete(
                      pendingChange.qstashMessageId,
                    );
                    console.log(
                      `Deleted QStash message: ${pendingChange.qstashMessageId}`,
                    );
                  } catch (error) {
                    console.error("Failed to delete QStash message:", error);
                  }
                }

                pendingChange.status = "reverted";
                await pendingChange.save();

                console.log(
                  `Successfully reverted scheduled change for subscription: ${payload.data.id}`,
                );
              }
            } catch (error) {
              console.error("Error handling scheduled change revert:", error);
            }

            try {
              const { sendSubscriptionUncanceledEmail } = await import(
                "@/lib/subscription-email-helpers"
              );
              const user = payload.data.customer;
              if (!user) return;

              await sendSubscriptionUncanceledEmail({
                userEmail: user.email,
                userName: user.name || "User",
                planName: payload.data.product?.name || "Premium",
                nextBillingDate: payload.data.currentPeriodEnd
                  ? new Date(payload.data.currentPeriodEnd)
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              });
            } catch (error) {
              console.error(
                "Error sending subscription uncanceled email:",
                error,
              );
            }
          },

          onSubscriptionRevoked: async (payload) => {
            console.log("Subscription revoked:", payload.data.id);
            try {
              const { sendSubscriptionRevokedEmail } = await import(
                "@/lib/subscription-email-helpers"
              );
              const user = payload.data.customer;
              if (!user) return;

              await sendSubscriptionRevokedEmail({
                userEmail: user.email,
                userName: user.name || "User",
                planName: payload.data.product?.name || "Premium",
              });
            } catch (error) {
              console.error("Error sending subscription revoked email:", error);
            }
          },

          onOrderRefunded: async (payload) => {
            console.log("Order refunded:", payload.data.id);
            try {
              const { sendOrderRefundedEmail } = await import(
                "@/lib/subscription-email-helpers"
              );
              const user = payload.data.customer;
              if (!user) return;

              const orderData = payload.data as unknown as {
                amount: number;
                currency: string;
                refund_reason?: string;
              };

              await sendOrderRefundedEmail({
                userEmail: user.email,
                userName: user.name || "User",
                amount: orderData.amount,
                currency: orderData.currency,
                refundReason: orderData.refund_reason,
              });
            } catch (error) {
              console.error("Error sending order refunded email:", error);
            }
          },
        }),
      ],
    }),
    nextCookies(),
  ],
});

export type ServerSession = typeof auth.$Infer.Session;
export type ServerUser = (typeof auth.$Infer.Session)["user"];
