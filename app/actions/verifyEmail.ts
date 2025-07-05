"use server";

import { connectDB } from "@/lib/mongodb";
import { VerificationToken } from "@/models/auth/Token";
import { User } from "@/models/auth/User";
import { Types } from "mongoose";

export async function verifyEmail(email: string, token: string) {
    try {
        await connectDB();
        const verificationToken = await VerificationToken.findOne({ token });
        if (!verificationToken) {
            return { success: false, message: "token-expired" };
        }
        console.log("userId:", verificationToken?._userId);
        console.log("email:", email);
        const user = await User.findOne({ _id: verificationToken?._userId, email: email });
        console.log(user);
        if (!user) {
            return { success: false, message: "user-not-found" };
        }
        if (user.emailVerified) {
            return { success: false, message: "already-verified" };
        }
        const updated = await User.findOneAndUpdate({ _id: verificationToken?._userId, email: email }, { emailVerified: true });
        if (updated) {
            return { success: true };
        }
        return { success: false, message: "error-updating" };
    } catch (error) {
        return { success: false, message: "server-error" };
    }
}