"use server";

import env from "@/utils/env";
import { z } from "zod";

const contactFormSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(5),
  message: z.string().min(10),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export async function sendToSlack(data: ContactFormData) {
  const webhookUrl = env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return { success: false, message: "Slack webhook URL is not configured" };
  }

  const parsed = contactFormSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, message: "Invalid form data" };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "New Shortn.at Contact Submission",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📬 New Contact Form Submission",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Name:*\n${parsed.data.name}`,
            },
            {
              type: "mrkdwn",
              text: `*Email:*\n${parsed.data.email}`,
            },
            {
              type: "mrkdwn",
              text: `*Subject:*\n${parsed.data.subject}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Message:*\n${parsed.data.message}`,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    return { success: false, message: "Failed to send message to Slack" };
  }

  return { success: true };
}
