"use server";
import { connectDB } from "@/lib/mongodb";
import { VerificationToken } from "@/models/auth/Token";
import { User } from "@/models/auth/User";
import env from "@/utils/env";
import { randomBytes, randomInt } from "crypto";
import { readFileSync } from "fs";
import nodemailer from "nodemailer";
import path from "path";

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