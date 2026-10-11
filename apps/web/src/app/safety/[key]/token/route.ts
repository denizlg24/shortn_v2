import { confirmationToken, keyPattern, publicLink } from "@shortn/core";
import { db } from "@/server/db";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

// Fetched by the interstitial's script after it loads, like legacy's
// getConfirmationToken, so crawlers that don't run JS can't skip the page.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!keyPattern.test(key))
    return Response.json({ error: "not_found" }, { status: 404 });
  const link = await publicLink(await db(), key);
  if (!link || link.blocked)
    return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(
    { token: await confirmationToken(key, env().CONFIRMATION_TOKEN_SECRET) },
    { headers: { "cache-control": "no-store" } },
  );
}
