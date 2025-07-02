"use server";
import { connectDB } from "@/lib/mongodb";
import { ResetToken } from "@/models/auth/ResetToken";
import { VerificationToken } from "@/models/auth/Token";
import { User } from "@/models/auth/User";
import env from "@/utils/env";
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