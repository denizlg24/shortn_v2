import NextAuth, { DefaultSession, CredentialsSignin } from "next-auth";
import { authConfig } from "./auth.config";
import credentials from "next-auth/providers/credentials";
import { connectDB } from "./lib/mongodb";
import { IPlan, User } from "./models/auth/User";
import bcrypt from "bcryptjs";
import GitHub from "next-auth/providers/github";
import Google, { GoogleProfile } from "next-auth/providers/google";
import { createFreePlan } from "./app/actions/stripeActions";
import { getStripeExtraInfo } from "./app/actions/stripeActions";

declare module "next-auth" {
  interface Session {
    user: {
      sub: string;
      displayName: string;
      stripeId: string;
      username: string;
      email: string;
      profilePicture?: string;
      emailVerified: boolean;
      createdAt: Date;
      plan: IPlan;
      links_this_month: number;
      qr_codes_this_month: number;
      phone_number: string;
      tax_id: string;
    } & DefaultSession["user"];
  }
  interface User {
    sub: string;
    displayName: string;
    stripeId: string;
    username: string;
    email: string;
    profilePicture?: string;
    emailVerified: boolean;
    createdAt: Date;
    plan: IPlan;
    links_this_month: number;
    qr_codes_this_month: number;
    phone_number: string;
    tax_id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
    displayName: string;
    stripeId: string;
    username: string;
    email: string;
    profilePicture?: string;
    emailVerified: boolean;
    createdAt: Date;
    plan: IPlan;
    links_this_month: number;
    qr_codes_this_month: number;
    phone_number: string;
    tax_id: string;
  }
}

export const { auth, signIn, signOut, handlers, unstable_update } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
  },
  providers: [
    GitHub({
      name: "Github",
      id: "github",
      async profile(profile) {
        await connectDB();
        const githubSub = "github|" + profile.id;
        const user = await User.findOne({ sub: githubSub });
        if (!user) {
          const rawUserData = profile;
          const sub = `github|${rawUserData.id}`;
          const { customerId } = await createFreePlan({
            name: rawUserData.name || rawUserData.email || rawUserData.login,
            email: rawUserData.email ?? undefined,
          });
          const newUser = new User({
            sub,
            displayName:
              rawUserData.name ||
              rawUserData.email ||
              rawUserData.login ||
              `GitHub ${rawUserData.id}`,
            username: rawUserData.login,
            stripeId: customerId,
            email: rawUserData.email || "",
            password: "Does Not Apply",
            profilePicture: rawUserData.avatar_url,
            emailVerified: true,
            createdAt: new Date(),
            plan: {
              subscription: "free",
              lastPaid: new Date(),
            },
            links_this_month: 0,
            qr_codes_this_month: 0,
          });
          await newUser.save();
          return {
            sub,
            displayName:
              rawUserData.name ||
              rawUserData.email ||
              rawUserData.login ||
              `GitHub ${rawUserData.id}`,
            username: rawUserData.login,
            stripeId: customerId,
            email: rawUserData.email || "",
            password: "Does Not Apply",
            profilePicture: rawUserData.avatar_url,
            emailVerified: true,
            createdAt: new Date(),
            plan: {
              subscription: "free",
              lastPaid: new Date(),
            },
            links_this_month: 0,
            qr_codes_this_month: 0,
            phone_number: "",
            tax_id: "",
          };
        }
        const { phone_number, tax_id } = await getStripeExtraInfo(
          user.stripeId,
        );
        return {
          id: user.id as string,
          sub: user.sub,
          email: user.email,
          displayName: user.displayName,
          profilePicture: user.profilePicture,
          stripeId: user.stripeId,
          username: user.username,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          plan: {
            subscription: user.plan.subscription,
            lastPaid: user.plan.lastPaid,
          },
          links_this_month: user.links_this_month,
          qr_codes_this_month: user.qr_codes_this_month,
          phone_number,
          tax_id,
        };
      },
    }),
    Google({
      name: "Google",
      id: "google",
      async profile(profile: GoogleProfile) {
        await connectDB();
        const googleSub = "google|" + profile.sub;
        const user = await User.findOne({ sub: googleSub });
        if (!user) {
          const rawUserData = profile;
          const sub = `google|${rawUserData.sub}`;
          const { customerId } = await createFreePlan({
            name: rawUserData.name,
            email: rawUserData.email ?? undefined,
          });
          const newUser = new User({
            sub,
            displayName: rawUserData.name ?? `Google ${rawUserData.sub}`,
            username: rawUserData.email.split("@")[0],
            stripeId: customerId,
            email: rawUserData.email,
            password: "Does Not Apply",
            profilePicture: rawUserData.picture,
            emailVerified: true,
            createdAt: new Date(),
            plan: {
              subscription: "free",
              lastPaid: new Date(),
            },
            links_this_month: 0,
            qr_codes_this_month: 0,
          });
          await newUser.save();
          return {
            sub,
            displayName: rawUserData.name ?? `Google ${rawUserData.sub}`,
            username: rawUserData.email.split("@")[0],
            stripeId: customerId,
            email: rawUserData.email,
            password: "Does Not Apply",
            profilePicture: rawUserData.picture,
            emailVerified: true,
            createdAt: new Date(),
            plan: {
              subscription: "free",
              lastPaid: new Date(),
            },
            links_this_month: 0,
            qr_codes_this_month: 0,
            phone_number: "",
            tax_id: "",
          };
        }
        const { phone_number, tax_id } = await getStripeExtraInfo(
          user.stripeId,
        );
        return {
          id: user.id as string,
          sub: user.sub,
          email: user.email,
          displayName: user.displayName,
          profilePicture: user.profilePicture,
          stripeId: user.stripeId,
          username: user.username,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          plan: {
            subscription: user.plan.subscription,
            lastPaid: user.plan.lastPaid,
          },
          links_this_month: user.links_this_month,
          qr_codes_this_month: user.qr_codes_this_month,
          phone_number,
          tax_id,
        };
      },
    }),
    credentials({
      name: "Credentials",
      id: "credentials",
      credentials: {
        email: { label: "EmailOrUsername", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        await connectDB();
        if (!credentials?.email || !credentials?.password) {
          throw new CredentialsSignin("email-password-missing");
        }
        const usernameFind = await User.findOne({
          username: credentials.email,
          sub: { $regex: /^authS\|/ },
        });
        const emailFind = await User.findOne({
          email: credentials.email,
          sub: { $regex: /^authS\|/ },
        });
        const account = emailFind || usernameFind;
        if (!account) throw new CredentialsSignin("no-account");

        const isValid = await bcrypt.compare(
          credentials.password as string,
          account.password,
        );
        if (!isValid) throw new CredentialsSignin("wrong-password");
        const user = account.toObject();
        if (!user.emailVerified) {
          throw new CredentialsSignin("not-verified");
        }
        const { phone_number, tax_id } = await getStripeExtraInfo(
          user.stripeId,
        );
        return {
          id: user.id as string,
          sub: user.sub,
          email: user.email,
          displayName: user.displayName,
          profilePicture: user.profilePicture,
          stripeId: user.stripeId,
          username: user.username,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          plan: {
            subscription: user.plan.subscription,
            lastPaid: user.plan.lastPaid,
          },
          links_this_month: user.links_this_month,
          qr_codes_this_month: user.qr_codes_this_month,
          phone_number,
          tax_id,
        };
      },
    }),
  ],
  debug: true,
});
