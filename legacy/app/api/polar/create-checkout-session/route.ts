import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";

const createCheckoutSessionDTO = z.object({
  slug: z.enum(["pro", "plus", "basic"]),
});

export async function POST(req: NextRequest) {
  try {
    const rateLimitId = createRateLimitIdentifier("checkout_session", req);
    const { error, auth: authResult } = await protectRoute(req, {
      requireAuth: true,
      rateLimit: {
        identifier: rateLimitId,
        preset: "sensitive",
      },
    });

    if (error) return error;

    const body = await req.json();
    const parsed = await createCheckoutSessionDTO.safeParseAsync(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Malformed input." },
        { status: 400 },
      );
    }

    const { url } = await auth.api.checkout({
      body: {
        slug: parsed.data.slug,
        allowDiscountCodes: true,
        referenceId: authResult.user!.id,
      },
      headers: req.headers,
    });
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { success: false, message: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
