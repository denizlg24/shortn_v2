"use server";
import env from "@/utils/env";
import { Resend } from "resend";
export async function sendEmail({
  from,
  to,
  subject,
  reactNode,
}: {
  from: string;
  to: string;
  subject: string;
  reactNode: React.ReactNode;
}) {
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: `Shortn.at <${from}>`,
      to: [to],
      subject: subject,
      react: reactNode,
    });
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}
