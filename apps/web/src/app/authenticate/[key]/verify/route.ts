import { accessCookieName, keyPattern, verifyLinkPassword } from "@shortn/core";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { redis } from "@/server/redis";
import { visitorIpHash } from "@/server/visitor";

// A plain form POST (no server action): the page is served on shortn.at
// through the edge Worker, where a server action's Origin check would fail.
// Redirects are relative so they stay on whichever host the visitor is on.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!keyPattern.test(key)) return new Response(null, { status: 404 });
  const form = await request.formData();
  const password = form.get("password");
  const back = (error: string) =>
    new Response(null, {
      status: 303,
      headers: {
        location: `/authenticate/${encodeURIComponent(key)}?error=${error}`,
      },
    });
  if (typeof password !== "string" || !password || password.length > 256)
    return back("missing");
  const result = await verifyLinkPassword(
    {
      db: await db(),
      counters: (await redis()).cache,
      linkAccessSecret: env().LINK_ACCESS_SECRET,
    },
    { key, password, ipHash: await visitorIpHash() },
  );
  if (!result.ok) return back(result.error);
  const secure = env().NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 303,
    headers: {
      location: `/${encodeURIComponent(key)}`,
      "set-cookie": `${accessCookieName(key)}=${result.token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict${secure}`,
    },
  });
}
