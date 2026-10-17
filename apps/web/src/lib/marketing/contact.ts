import { z } from "zod";

export const contactTopics = ["sales", "billing", "account", "other"] as const;
export type ContactTopic = (typeof contactTopics)[number];
export const contactLimits = { messageMin: 20, messageMax: 4000 } as const;

export const contactInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  company: z.string().trim().max(160).optional(),
  topic: z.enum(contactTopics),
  message: z
    .string()
    .trim()
    .min(contactLimits.messageMin)
    .max(contactLimits.messageMax),
  token: z.string(),
  // Left empty by people; filled by naive bots.
  website: z.string().max(0).optional(),
});
export type ContactInput = z.infer<typeof contactInput>;

/** Legacy's `CT-YYYYMMDD-XXXXX` format, which the admin console shows. */
export function ticketId(now: Date, random: () => number = Math.random) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let index = 0; index < 5; index++)
    suffix += alphabet[Math.floor(random() * alphabet.length)];
  return `CT-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${suffix}`;
}
