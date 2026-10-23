import {
  collection,
  feedbackCategories,
  feedbackMessageMax,
  type Documents,
} from "@shortn/db";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { fail, ok, type Result } from "../result";
import { nowOf, type ServiceContext } from "../workspaces/context";

export const feedbackHourlyLimit = 10;

export const feedbackInput = z.object({
  category: z.enum(feedbackCategories),
  message: z.string().trim().min(1).max(feedbackMessageMax),
  page: z.string().max(500).optional(),
  locale: z.string().max(10).optional(),
  userAgent: z.string().optional(),
});
export type FeedbackInput = z.input<typeof feedbackInput>;

export type FeedbackError = "invalid_input" | "forbidden" | "rate_limited";

/** Staff acting as the user can't speak for them, so impersonation is refused. */
export async function submitFeedback(
  ctx: ServiceContext,
  input: FeedbackInput,
): Promise<Result<{ id: string }, FeedbackError>> {
  if (ctx.actor.impersonation || ctx.actor.via) return fail("forbidden");
  const parsed = feedbackInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const now = nowOf(ctx);
  const feedback = collection(ctx.db, "feedback");
  const recent = await feedback.countDocuments(
    {
      userId: ctx.actor.userId,
      createdAt: { $gt: new Date(now.getTime() - 3_600_000) },
    },
    { limit: feedbackHourlyLimit },
  );
  if (recent >= feedbackHourlyLimit) return fail("rate_limited");
  const { category, message, page, locale, userAgent } = parsed.data;
  const _id = new ObjectId();
  await feedback.insertOne({
    _id,
    userId: ctx.actor.userId,
    workspaceId: ctx.workspace._id,
    category,
    message,
    ...(page ? { page } : {}),
    ...(locale ? { locale } : {}),
    ...(userAgent ? { userAgent: userAgent.slice(0, 500) } : {}),
    createdAt: now,
  });
  return ok({ id: _id.toHexString() });
}

export interface FeedbackView {
  id: string;
  category: Documents["feedback"]["category"];
  message: string;
  status: NonNullable<Documents["feedback"]["triage"]>["status"];
  createdAt: Date;
}

/** The signed-in user's own recent feedback, newest first. */
export async function listOwnFeedback(
  ctx: ServiceContext,
  limit = 20,
): Promise<FeedbackView[]> {
  const rows = await collection(ctx.db, "feedback")
    .find({ userId: ctx.actor.userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 50))
    .toArray();
  return rows.map((row) => ({
    id: row._id.toHexString(),
    category: row.category,
    message: row.message,
    status: row.triage?.status ?? "new",
    createdAt: row.createdAt,
  }));
}
