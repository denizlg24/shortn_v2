"use server";

import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/auth/User";

export async function updateEmail(sub: string, newEmail: string) {
    try {
        await connectDB();
        const subType = sub.split('|')[0];
        const foundUser = await User.findOne({ sub: { $regex: new RegExp('^' + subType + '\\|') }, email: newEmail });
        if (foundUser) {
            return { success: false, message: "email-taken" };
        }
        const updated = await User.findOneAndUpdate({ sub }, { email: newEmail, emailVerified: false });
        if (updated) {
            return { success: true, message: null };
        }
        return { success: false, message: "error-updating" }
    } catch (error) {
        return { success: false, message: "server-error" };
    }
}