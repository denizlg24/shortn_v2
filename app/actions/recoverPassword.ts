"use server";

import { connectDB } from "@/lib/mongodb";
import { ResetToken } from "@/models/auth/ResetToken";
import { VerificationToken } from "@/models/auth/Token";
import { User } from "@/models/auth/User";
import { hashSync } from "bcryptjs";

export async function recoverPassword(token: string, password: string) {
    try {
        await connectDB();
        const verificationToken = await ResetToken.findOne({ token });
        if (!verificationToken) {
            return { success: false, message: "token-expired" };
        }
        const user = await User.findOne({ sub: verificationToken.sub });
        if (!user) {
            return { success: false, message: "user-not-found" };
        }
        const hashedPassword = hashSync(password, 10);
        const updated = await User.findOneAndUpdate({ sub: verificationToken.sub }, { password: hashedPassword });
        if (updated) {
            return { success: true };
        }
        return { success: false, message: "error-updating" };
    } catch (error) {
        return { success: false, message: "server-error" };
    }
}