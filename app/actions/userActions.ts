"use server";

import { connectDB } from "@/lib/mongodb";
import { VerifyReactEmail } from "@/components/emails/verify-react-email";

export async function sendRecoveryEmail(email: string, url: string) {
  await connectDB();
  const hrefLink = url;
  const response = await sendEmail({
    from: "no-reply@shortn.at",
    to: email,
    subject: "Shortn Account Recovery",
    reactNode: ResetPasswordEmail({ resetLink: hrefLink }),
  });
  if (!response) {
    return { success: false, token: undefined };
  }
  return { success: true, token: undefined };
}

import { LoginRecord } from "@/models/auth/LoginActivity";
import { Geo } from "@vercel/functions";
import { sendEmail } from "./sendEmail";
import { ResetPasswordEmail } from "@/components/emails/reset-password-react-email";
import { UpdateEmailReactEmail } from "@/components/emails/update-email-react-email";

export async function sendVerificationEmail(email: string, url: string) {
  await connectDB();
  const hrefLink = url;
  const response = await sendEmail({
    from: "no-reply@shortn.at",
    to: email,
    subject: "Shortn Account Verification",
    reactNode: VerifyReactEmail({ verificationLink: hrefLink }),
  });
  if (!response) {
    return false;
  }
  return true;
}

export async function sendUpdateEmailVerificationEmail(
  email: string,
  url: string,
  newEmail: string,
) {
  await connectDB();
  const hrefLink = url;
  const response = await sendEmail({
    from: "no-reply@shortn.at",
    to: email,
    subject: "Shortn Account Update Verification",
    reactNode: UpdateEmailReactEmail({ verificationLink: hrefLink, newEmail }),
  });
  if (!response) {
    return false;
  }
  return true;
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
