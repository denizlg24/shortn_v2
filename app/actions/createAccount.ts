"use server";

import { connectDB } from "@/lib/mongodb";
import { generateUniqueId } from "@/lib/utils";
import { User } from "@/models/auth/User";
import bcrypt from "bcryptjs";
import { createFreePlan } from "./createFreePlan";
import { VerificationToken } from "@/models/auth/Token";
import { randomBytes, randomInt } from "crypto";
import { sendVerificationEmail } from "./sendVerificationEmail";

export const createAccount = async ({ email, password, username, displayName, locale }: { email: string, password: string, username: string, displayName: string, locale: string }) => {
    try {
        await connectDB();
        const emailFind = await User.findOne({ email, sub: /^authS/ });
        if (emailFind) {
            return { success: false, error: 'email-taken' }
        }
        const usernameFind = await User.findOne({ username, sub: /^authS/ });
        if (usernameFind) {
            return { success: false, error: 'username-taken' }
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const subId = generateUniqueId();
        const sub = `authS|${subId}`;

        const { customerId } = await createFreePlan({ name: displayName, email });
        const newUser = new User({
            sub: sub,
            displayName: displayName,
            username: username,
            email: email,
            stripeId: customerId,
            password: hashedPassword,
            profilePicture: `https://robohash.org/${username}`,
            createdAt: new Date(),
            plan: {
                subscription: "free",
                lastPaid: new Date(),
            },
        });
        await newUser.save();


        const verificationMail = await sendVerificationEmail(email, locale);
        if (verificationMail) {
            return { success: true };
        } else {
            return { success: false, error: "verification-token" };
        }
    } catch (error) {
        console.log(error);
        return { success: false, error: "server-error" };
    }
}
