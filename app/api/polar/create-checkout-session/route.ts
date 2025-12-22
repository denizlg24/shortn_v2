import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const createCheckoutSessionDTO = z.object({
  slug: z.enum(["pro", "plus", "basic"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = await createCheckoutSessionDTO.safeParseAsync(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Malformed input." },
        { status: 401 },
      );
    }
    const data = await auth.api.getSession({
      headers: req.headers,
    });
    if (!data?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }
    const { url } = await auth.api.checkout({
      body: {
        slug: parsed.data.slug,
        allowDiscountCodes: true,
        referenceId: data.user.id,
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
