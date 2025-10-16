import type { NextAuthConfig } from "next-auth";
import env from "./utils/env";

export const authConfig = {
  secret: env.AUTH_SECRET,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.sub;
        token.email = user.email;
        token.displayName = user.displayName;
        token.profilePicture = user.profilePicture || "";
        token.stripeId = user.stripeId;
        token.username = user.username;
        token.createdAt = user.createdAt;
        token.plan = user.plan;
        token.links_this_month = user.links_this_month;
        token.qr_codes_this_month = user.qr_codes_this_month;
        token.tax_id = user.tax_id;
        token.phone_number = user.phone_number;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.sub = token.sub;
        session.user.email = token.email;
        session.user.displayName = token.displayName;
        session.user.profilePicture = token.profilePicture;
        session.user.stripeId = token.stripeId;
        session.user.username = token.username;
        session.user.createdAt = token.createdAt;
        session.user.plan = token.plan;
        session.user.links_this_month = token.links_this_month;
        session.user.qr_codes_this_month = token.qr_codes_this_month;
        session.user.phone_number = token.phone_number;
        session.user.tax_id = token.tax_id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
