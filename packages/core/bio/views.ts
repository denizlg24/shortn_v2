import { z } from "zod";
export const bioViewMessageSchema = z.object({
  v: z.literal(1),
  kind: z.literal("bio_view"),
  pageId: z.string().regex(/^[a-f\d]{24}$/i),
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i),
  ts: z.number().int().positive(),
  refDomain: z.string().max(253).optional(),
  country: z.string().max(8).optional(),
});
export type BioViewMessage = z.infer<typeof bioViewMessageSchema>;
