"use server";


import { connectDB } from "@/lib/mongodb";
import { generateUniqueId } from "@/lib/utils";
import { User } from "@/models/auth/User";
import bcrypt from "bcryptjs";
import { createFreePlan } from "./stripeActions";

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
        return { success: false, error: "server-error" };
    }
}

import env from "@/utils/env";
import { deletePicture } from "./deletePicture";

export async function deleteProfilePicture(sub: string, oldPic: string) {

    try {
        await connectDB();
        const { success } = await updateUserField(sub, "profilePicture", "");
        if (success) {
            if (oldPic.startsWith(`https://${env.PINATA_GATEWAY}`)) {
                await deletePicture(oldPic);
            }
            return { success };
        }
        return { success: false, message: 'error-deleting' }
    } catch (e) {
        return { success: false, message: 'server-error' };
    }
}

import { auth } from "@/auth";
import { getStripeExtraInfo } from "./stripeActions";

export async function getUser() {
    const session = await auth();
    try {
        if (session?.user) {
            await connectDB();
            const sub = session.user.sub;
            const [user, stripeExtra] = await Promise.all([
                User.findOne({ sub }),
                (async () => {
                    const u = await User.findOne({ sub }, { stripeId: 1 });
                    if (u?.stripeId) {
                        return getStripeExtraInfo(u.stripeId);
                    }
                    return { phone_number: "", tax_id: "" };
                })()
            ]);
            if (!user) {
                return { success: false, user: null };
            }
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
                    qr_codes_this_month: user.qr_codes_this_month || 0,
                    phone_number: stripeExtra.phone_number,
                    tax_id: stripeExtra.tax_id
                }
            }
        }
        return { success: false, user: null };
    } catch (error) {
        return { success: false, user: null };
    }
}

import { ResetToken } from "@/models/auth/ResetToken";
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

import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import nodemailer from "nodemailer";
import path from "path";

export async function sendRecoveryEmail(email: string, locale: string) {
    await connectDB();
    const user = await User.findOne({ email, sub: /^authS/ });
    if (!user) {
        return { success: false, message: "no-user" };
    }
    const token = new ResetToken({
        sub: user.sub,
        token: randomBytes(32).toString("hex"),
    });
    await token.save();
    const hrefLink = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/recover/${token.token}`;
    const htmlPath = path.join(process.cwd(), "lib/email/templates/passwordRecovery.mail.html");
    let html = readFileSync(htmlPath, "utf8");
    html = html.replace(/{{RECOVERY_LINK}}/g, hrefLink);
    const transporter = nodemailer.createTransport({
        host: "smtp.hostinger.com",
        port: 465,
        secure: true, // upgrade later with STARTTLS
        auth: {
            user: env.WEBMAIL_USER,
            pass: env.WEBMAIL_PASS,
        },
    });
    const mailOptions = {
        from: "no-reply@shortn.at",
        to: email,
        subject: "Shortn Account Recovery",
        html,
    };
    transporter.sendMail(mailOptions, function (err) {
        if (err) {
            return { success: false, message: "mail-error" };
        }
    });
    return { success: true };
}

import { VerificationToken } from "@/models/auth/Token";

export async function sendVerificationEmail(email: string, locale: string) {
    await connectDB();
    const user = await User.findOne({ email, sub: /^authS/ });
    if (!user) {
        return false;
    }
    const token = new VerificationToken({
        _userId: user._id,
        token: randomBytes(16).toString("hex"),
    });
    await token.save();
    const hrefLink = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/register/confirmation/${email}/${token.token}`;
    const htmlPath = path.join(process.cwd(), "lib/email/templates/verification.mail.html");
    let html = readFileSync(htmlPath, "utf8");
    html = html.replace(/{{VERIFY_EMAIL}}/g, hrefLink);
    const transporter = nodemailer.createTransport({
        host: "smtp.hostinger.com",
        port: 465,
        secure: true, // upgrade later with STARTTLS
        auth: {
            user: env.WEBMAIL_USER,
            pass: env.WEBMAIL_PASS,
        },
    });
    const mailOptions = {
        from: "no-reply@shortn.at",
        to: email,
        subject: "Shortn Account Verification",
        html,
    };
    transporter.sendMail(mailOptions, function (err) {
        if (err) {
            return false;
        }
    });
    return true;
}

export async function updateEmail(newEmail: string) {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }
        const sub = user?.sub;
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

export async function verifyEmail(email: string, token: string) {
    try {
        await connectDB();
        const verificationToken = await VerificationToken.findOne({ token });
        if (!verificationToken) {
            return { success: false, message: "token-expired" };
        }
        const user = await User.findOne({ _id: verificationToken?._userId, email: email });
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