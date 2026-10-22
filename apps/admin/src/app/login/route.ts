import { NextResponse, type NextRequest } from "next/server";
import { startElevation } from "@/server/elevation";
import { env } from "@/server/env";
import { currentAdmin } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  if (await currentAdmin())
    return NextResponse.redirect(new URL(next ?? "/", env().ADMIN_ORIGIN));
  return NextResponse.redirect(await startElevation("login", next));
}
