import NextAuth, { User as NextUser, DefaultSession, CredentialsSignin } from "next-auth";
import { authConfig } from "./auth.config";
import credentials from 'next-auth/providers/credentials';
import { connectDB } from './lib/mongodb';
import { IPlan, User } from './models/auth/User';
import bcrypt from "bcryptjs";
import { JWT } from "next-auth/jwt"

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
        } & DefaultSession["user"]
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
    }
}

export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    session: {
        strategy: "jwt",
    },
    providers: [
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
                    throw new CredentialsSignin("Missing email or password");
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
                if (!account) throw new CredentialsSignin("No account found with those credentials");

                const isValid = await bcrypt.compare(credentials.password as string, account.password);
                if (!isValid) throw new CredentialsSignin("Invalid password");

                const user = account.toObject();
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
                        lastPaid: user.plan.lastPaid
                    },
                    links_this_month: user.links_this_month,
                };
            },
        }),
    ],
})