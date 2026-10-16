import { z } from "zod";
import { validateDestination } from "../safety/structural";

export const socialPreviewSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(500).optional(),
    image: z
      .httpUrl()
      .max(2048)
      .refine(
        (value) =>
          validateDestination(value).ok &&
          new URL(value).protocol === "https:" &&
          !new URL(value).username &&
          !new URL(value).password,
        "Use a public HTTPS image URL",
      )
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((value) => value !== undefined),
    "Configure at least one preview field",
  );
export type SocialPreview = z.infer<typeof socialPreviewSchema>;

// Invalid legacy metadata must never prevent a human destination redirect.
export function readSocialPreview(value: unknown): SocialPreview | undefined {
  const parsed = socialPreviewSchema.safeParse(value);
  return parsed.success
    ? (JSON.parse(JSON.stringify(parsed.data)) as SocialPreview)
    : undefined;
}

// Preview crawlers get metadata; search indexers and arbitrary automated clients
// retain ordinary redirects. Bound raw UAs just like click-message parsing.
export function isLinkPreviewBot(userAgent: string): boolean {
  return /(?:^|[\s(;])(?:facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot(?:-linkexpanding)?|discordbot|telegrambot|whatsapp|skypeuripreview|microsoftpreview|pinterestbot|redditbot)(?:\b|\/)/i.test(
    userAgent.slice(0, 2000),
  );
}
