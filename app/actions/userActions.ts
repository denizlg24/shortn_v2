"use server";

import { connectDB } from "@/lib/mongodb";
import { generateUniqueId } from "@/lib/utils";
import { User } from "@/models/auth/User";
import bcrypt, { compareSync } from "bcryptjs";
import { createFreePlan } from "./stripeActions";

export const createAccount = async ({
  email,
  password,
  username,
  displayName,
  locale,
}: {
  email: string;
  password: string;
  username: string;
  displayName: string;
  locale: string;
}) => {
  try {
    await connectDB();
    const emailFind = await User.findOne({ email, sub: /^authS/ });
    if (emailFind) {
      return { success: false, error: "email-taken" };
    }
    const usernameFind = await User.findOne({ username, sub: /^authS/ });
    if (usernameFind) {
      return { success: false, error: "username-taken" };
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
      return { success: true, token: verificationMail };
    } else {
      return { success: false, error: "verification-token" };
    }
  } catch (error) {
    console.log(error);
    return { success: false, error: "server-error" };
  }
};

import env from "@/utils/env";
import { deletePicture } from "./deletePicture";

export async function deleteProfilePicture(sub: string, oldPic: string) {
  try {
    await connectDB();
    const { success } = await updateUserField("profilePicture", "");
    if (success) {
      if (oldPic.startsWith(`https://${env.PINATA_GATEWAY}`)) {
        await deletePicture(oldPic);
      }
      return { success };
    }
    return { success: false, message: "error-deleting" };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return { success: false, message: "server-error" };
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
          return { phone_number: "", tax_ids: undefined };
        })(),
      ]);
      if (!user) {
        return { success: false, user: null };
      }
      const tax_id =
        (stripeExtra?.tax_ids?.data?.length ?? 0) == 1
          ? stripeExtra.tax_ids!.data[0].value
          : "";
      return {
        success: true,
        user: {
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
            lastPaid: user.plan.lastPaid,
          },
          links_this_month: user.links_this_month,
          qr_codes_this_month: user.qr_codes_this_month || 0,
          phone_number: stripeExtra.phone_number,
          tax_id,
        },
      };
    }
    return { success: false, user: null };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const updated = await User.findOneAndUpdate(
      { sub: verificationToken.sub },
      { password: hashedPassword },
    );
    if (updated) {
      return { success: true };
    }
    return { success: false, message: "error-updating" };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const headersList = await headers();
  const domain = headersList.get("host");
  const hrefLink = `${domain}/${locale}/recover/${token.token}`;
  const htmlPath = path.join(
    process.cwd(),
    "lib/email/templates/passwordRecovery.mail.html",
  );
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
import { headers } from "next/headers";
import { LoginRecord } from "@/models/auth/LoginActivity";
import { Geo } from "@vercel/functions";

export async function sendVerificationEmail(email: string, locale: string) {
  await connectDB();
  const user = await User.findOne({ email, sub: /^authS/ });
  if (!user) {
    return false;
  }
  const prefixToken = randomBytes(16).toString("hex");
  const token = new VerificationToken({
    _userId: user._id,
    token: prefixToken + env.EMAIL_TOKEN_SUFFIX,
  });
  await token.save();
  const headersList = await headers();
  const domain = headersList.get("host");
  const hrefLink = `${domain}/${locale}/register/confirmation/${email}/${token.token}`;
  const htmlPath = path.join(
    process.cwd(),
    "lib/email/templates/verification.mail.html",
  );
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
  return prefixToken;
}

export async function updateEmail(newEmail: string) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    await connectDB();
    const subType = sub.split("|")[0];
    const foundUser = await User.findOne({
      sub: { $regex: new RegExp("^" + subType + "\\|") },
      email: newEmail,
    });
    if (foundUser) {
      return { success: false, message: "email-taken" };
    }
    const updated = await User.findOneAndUpdate(
      { sub },
      { email: newEmail, emailVerified: false },
    );
    if (updated) {
      return { success: true, message: null };
    }
    return { success: false, message: "error-updating" };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, message: "server-error" };
  }
}

export async function updateUserField(field: string, value: unknown) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    await connectDB();
    const sub = user?.sub;
    if (field == "username") {
      const duplicateUser = await User.findOne({ username: value });
      if (duplicateUser) {
        return { success: false, message: "duplicate" };
      }
    }
    const foundUser = await User.findOneAndUpdate({ sub }, { [field]: value });
    if (foundUser) {
      return { success: true, message: null };
    }
    return { success: false, message: "user-not-found" };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, message: "server-error" };
  }
}

export async function verifyEmail(email: string, token: string) {
  try {
    await connectDB();
    const verificationToken = await VerificationToken.findOne({ token });
    if (!verificationToken) {
      return { success: false, message: "token-expired" };
    }
    const user = await User.findOne({
      _id: verificationToken?._userId,
      email: email,
    });
    if (!user) {
      return { success: false, message: "user-not-found" };
    }
    if (user.emailVerified) {
      return { success: false, message: "already-verified" };
    }
    const updated = await User.findOneAndUpdate(
      { _id: verificationToken?._userId, email: email },
      { emailVerified: true },
    );
    if (updated) {
      return { success: true };
    }
    return { success: false, message: "error-updating" };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, message: "server-error" };
  }
}

export async function updatePassword({
  old,
  newPassword,
}: {
  old: string;
  newPassword: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("unauthenticated");
    }
    await connectDB();
    const user = await User.findOne({ sub: session.user.sub });
    if (!user) {
      return { success: false, message: "user-not-found" };
    }
    const verifyOld = compareSync(old, user.password);
    if (!verifyOld) {
      return { success: false, message: "password-incorrect" };
    }

    const hashedPassword = hashSync(newPassword, 10);
    const updated = await User.findOneAndUpdate(
      { sub: session.user.sub },
      { password: hashedPassword },
    );
    if (updated) {
      return { success: true };
    }
    return { success: false, message: "server-error" };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, message: "server-error" };
  }
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
