import type { NextAuthConfig } from 'next-auth';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export const authConfig = {
    providers: [],
    callbacks: {
        authorized({ auth, request }) {
            const isLoggedIn = !!auth?.user;
            const locale = request.cookies.get('NEXT_LOCALE')?.value || 'en';
            const isDashboardRoot = request.nextUrl.pathname === `/${locale}/dashboard`;
            const isDashboard = request.nextUrl.pathname.startsWith(`/${locale}/dashboard`);
            const isLogin = request.nextUrl.pathname.startsWith(`/${locale}/login`);
            const isRegister = request.nextUrl.pathname.startsWith(`/${locale}/register`);

            const userOrgId = auth?.user?.sub.split("|")[1];

            if (isDashboard && !isLoggedIn) {
                return Response.redirect(new URL(`/${locale}/login`, request.nextUrl));
            }
            if (isDashboard && isLoggedIn) {
                const segments = request.nextUrl.pathname.split("/");
                const orgIdInUrl = segments[3];

                if (orgIdInUrl && orgIdInUrl !== userOrgId) {
                    return Response.redirect(new URL(`/${locale}/dashboard/${userOrgId}`, request.nextUrl));
                }
            }
            if ((isLogin || isRegister || isDashboardRoot) && isLoggedIn) {
                return Response.redirect(new URL(`/${locale}/dashboard/${userOrgId}`, request.nextUrl));
            }

            if (!isDashboard && isLoggedIn) {
                return Response.redirect(new URL(`/${locale}/dashboard/${userOrgId}`, request.nextUrl));
            }



            return intlMiddleware(request);
        },
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
                token.links_this_month = token.links_this_month;
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
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
    },
} satisfies NextAuthConfig;