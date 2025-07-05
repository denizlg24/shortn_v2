"use server";

import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/auth/User";
import { getStripeExtraInfo } from "./getStripeExtraInfo";

export async function getUser() {
    const session = await auth();
    try {
        if (session?.user) {
            await connectDB();
            const sub = session.user.sub;
            const user = await User.findOne({ sub });
            if (!user) {
                return { success: false, user: null };
            }
            const { phone_number, tax_id } = await getStripeExtraInfo(user.stripeId);
            return {
                success: true, user: {
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
                    phone_number,
                    tax_id
                }
            }
        }
        return { success: false, user: null };
    } catch (error) {
        return { success: false, user: null };
    }
}