import { auth } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const cookieStore = await cookies();

  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("shortn_auth_")) {
      cookieStore.delete(cookie.name);
    }
  }

  await auth.api.signOut({
    headers: await headers(),
  });

  return NextResponse.redirect(new URL("/login", req.url));
}
