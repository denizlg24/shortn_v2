import { collection } from "@shortn/db";
import { MongoServerError, ObjectId } from "mongodb";
import { getTranslations } from "next-intl/server";
import { contactInput, ticketId } from "@/lib/marketing/contact";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { mail } from "@/server/mail";
import { toLocale } from "@/server/marketing";
import {
  ipHash,
  json,
  requestIp,
  trustedOrigin,
  utcDay,
  verifyTurnstile,
  withinLimits,
} from "@/server/public-forms";

// Writes legacy's `contacts` collection unchanged, so the admin console keeps
// reading it (D-M7). The address is stored as its HMAC, not in the clear.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const locale = toLocale((await params).locale) ?? "en";
  const e = env();
  if (!e.TURNSTILE_SECRET_KEY) return json({ error: "failed" }, 503);
  if (!trustedOrigin(request)) return json({ error: "failed" }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 16_384)
    return json({ error: "messageLong" }, 413);
  const parsed = contactInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const input = parsed.data;

  const ip = requestIp(request);
  const challenge = await verifyTurnstile(
    input.token,
    ip,
    e.TURNSTILE_SECRET_KEY,
  );
  if (challenge === "failed") return json({ error: "challenge" }, 403);
  if (challenge === "unavailable") return json({ error: "failed" }, 503);

  const visitor = ipHash(ip);
  try {
    if (
      !(await withinLimits([
        { key: `contact:ip:10m:${visitor}`, max: 3, seconds: 600 },
        {
          key: `contact:ip:day:${utcDay()}:${visitor}`,
          max: 10,
          seconds: 86_400,
        },
      ]))
    )
      return json({ error: "rateLimited" }, 429);

    const topics = await getTranslations({
      locale: "en",
      namespace: "marketing.contact.form.topics",
    });
    const now = new Date();
    let reference = "";
    for (let attempt = 0; attempt < 5 && !reference; attempt++) {
      const candidate = ticketId(now);
      try {
        await collection(await db(), "contacts").insertOne({
          _id: new ObjectId(),
          ticketId: candidate,
          name: input.name,
          subject: topics(input.topic),
          email: input.email.toLowerCase(),
          ...(input.company ? { company: input.company } : {}),
          message: input.message,
          ipAddress: visitor,
          userAgent: (request.headers.get("user-agent") ?? "unknown").slice(
            0,
            500,
          ),
          createdAt: now,
          updatedAt: now,
        });
        reference = candidate;
      } catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000))
          throw error;
      }
    }
    if (!reference) return json({ error: "failed" }, 503);

    const mailer = mail();
    const results = await Promise.allSettled([
      mailer.contactReceived({
        to: input.email,
        locale,
        reference,
        message: input.message,
      }),
      e.CONTACT_INBOX
        ? mailer.contactNotification({
            to: e.CONTACT_INBOX,
            replyTo: input.email,
            reference,
            name: input.name,
            email: input.email,
            company: input.company,
            topic: topics(input.topic),
            locale,
            message: input.message,
          })
        : Promise.resolve(),
    ]);
    for (const result of results)
      if (result.status === "rejected")
        console.error("contact mail failed", {
          reference,
          error: result.reason,
        });
    return json({ reference, email: input.email });
  } catch (error) {
    console.error("contact submission failed", error);
    return json({ error: "failed" }, 503);
  }
}
