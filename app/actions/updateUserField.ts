"use server";

import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/auth/User";

export async function updateUserField(sub: string, field: string, value: unknown) {
    try {
        await connectDB();
        const user = await User.findOneAndUpdate({ sub }, { [field]: value });
        if (user) {
            return { success: true, message: null };
        }
        return { success: false, message: "user-not-found" }
    } catch (error) {
        return { success: false, message: "server-error" }
    }
}