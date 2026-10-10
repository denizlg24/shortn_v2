import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import env from "@/utils/env";

export const dynamic = "force-dynamic";

const matches = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * P4 coexistence: the new dashboard edits bio pages that this app still
 * renders statically at /b/{slug}; it calls here after each save.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-internal-secret") ?? "";
  if (!matches(secret, env.INTERNAL_API_SECRET))
    return NextResponse.json({ ok: false }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const slugs =
    body &&
    typeof body === "object" &&
    "slugs" in body &&
    Array.isArray(body.slugs)
      ? body.slugs.filter(
          (slug: unknown): slug is string =>
            typeof slug === "string" && /^[\w-]{1,100}$/.test(slug),
        )
      : [];
  for (const slug of slugs) {
    revalidatePath(`/b/${slug}`, "page");
    revalidatePath(`/b/${slug}`, "layout");
  }
  return NextResponse.json({ ok: true, revalidated: slugs.length });
}
