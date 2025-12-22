"use server";

import { connectDB } from "@/lib/mongodb";
import { LoginRecord } from "@/models/auth/LoginActivity";
import { Geo } from "@vercel/functions";
import { sendEmail, sendReactEmail } from "./sendEmail";
import { resetPasswordEmailTemplate } from "@/lib/email-templates";
import { ReactNode } from "react";

export async function sendReactEmailLegacy({
  react,
  email,
  subject,
}: {
  react: ReactNode;
  email: string;
  subject: string;
}) {
  const response = await sendReactEmail({
    from: "no-reply@shortn.at",
    to: email,
    subject: subject,
    reactNode: react,
  });
  if (!response) {
    return { success: false, token: undefined };
  }
  return { success: true, token: undefined };
}

export async function sendRecoveryEmail(email: string, url: string) {
  await connectDB();
  const response = await sendEmail({
    from: "no-reply@shortn.at",
    to: email,
    subject: "Reset your Shortn password",
    html: resetPasswordEmailTemplate({
      resetLink: url,
      expiryMinutes: 10,
    }),
  });
  if (!response) {
    return { success: false, token: undefined };
  }
  return { success: true, token: undefined };
}

export async function loginAttempt({
  sub,
  success,
  location,
  ip,
  type,
}: {
  sub: string;
  success: boolean;
  location: Geo | undefined;
  ip: string | undefined;
  type: string;
}) {
  try {
    await connectDB();
    const newLoginRecord = await LoginRecord.create({
      sub,
      succeeded: success,
      ip,
      location: [location?.city ?? "", location?.country ?? ""].join(", "),
      type,
    });
    if (newLoginRecord) {
      return { success: true };
    }
    return { success: false };
  } catch (error) {
    return { success: false, message: error };
  }
}

export async function getLoginRecordsCount({ sub }: { sub: string }) {
  try {
    await connectDB();
    const loginRecords = await LoginRecord.find({ sub }).countDocuments();
    return loginRecords ?? 0;
  } catch (error) {
    console.log(error);
    return 0;
  }
}

export async function getLoginRecords({
  limit,
  sub,
}: {
  limit: number | undefined;
  sub: string;
}) {
  try {
    await connectDB();
    const loginRecords = limit
      ? await LoginRecord.find({ sub }).sort({ at: -1 }).limit(limit).lean()
      : await LoginRecord.find({ sub }).sort({ at: -1 }).lean();
    return {
      success: true,
      loginRecords: loginRecords.map((record) => ({
        ...record,
        _id: record._id.toString(),
      })),
    };
  } catch (error) {
    console.log(error);
    return { success: false, loginRecords: [] };
  }
}
