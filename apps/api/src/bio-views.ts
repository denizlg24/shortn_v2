import { activeDomain } from "@shortn/core";
import { physicalNames } from "@shortn/db";
import { keys } from "@shortn/redis";
import { createHmac } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import type { Redis } from "ioredis";
import { isbot } from "isbot";
import { z } from "zod";
const input = z.object({
  pageId: z.string().regex(/^[a-f\d]{24}$/i),
  referrer: z.string().max(2048).optional(),
});
export async function receiveBioView(
  request: Request,
  deps: {
    db: Db;
    durable: Pick<Redis, "eval" | "set" | "xadd">;
    secret: string;
    rootOrigin: string;
    webOrigin?: string | undefined;
    subdomains: boolean;
  },
) {
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (
    request.headers.get("dnt") === "1" ||
    isbot(request.headers.get("user-agent") ?? "")
  )
    return new Response(null, { status: 204, headers });
  const body = await request.text();
  if (body.length > 4096) return new Response(null, { status: 413, headers });
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400, headers });
  }
  const parsed = input.safeParse(raw);
  if (!parsed.success) return new Response(null, { status: 400, headers });
  const page = await deps.db
    .collection(physicalNames.bio_pages)
    .findOne({ _id: new ObjectId(parsed.data.pageId), published: true });
  if (!page?.workspaceId) return new Response(null, { status: 404, headers });
  const origin = request.headers.get("origin");
  if (!origin) return new Response(null, { status: 403, headers });
  const allowed = new Set([
    deps.rootOrigin,
    ...(deps.webOrigin ? [new URL(deps.webOrigin).origin] : []),
  ]);
  if (deps.subdomains && page.handle) {
    const root = new URL(deps.rootOrigin);
    allowed.add(`${root.protocol}//${page.handle}.${root.host}`);
  }
  if (!allowed.has(origin)) {
    let hostname: string;
    try {
      hostname = new URL(origin).hostname;
    } catch {
      return new Response(null, { status: 403, headers });
    }
    const domain = await activeDomain(deps.db, hostname);
    if (
      !domain ||
      String(domain.bioPageId) !== String(page._id) ||
      origin !== `https://${hostname}`
    )
      return new Response(null, { status: 403, headers });
  }
  headers.set("Access-Control-Allow-Origin", origin);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const hash = createHmac("sha256", deps.secret).update(ip).digest("hex");
  const count = await deps.durable.eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
    1,
    `bio-view-rate:${hash}`,
  );
  if (Number(count) > 60) return new Response(null, { status: 429, headers });
  if (
    !(await deps.durable.set(
      `bio-view-once:${hash}:${page._id}`,
      "1",
      "EX",
      1800,
      "NX",
    ))
  )
    return new Response(null, { status: 204, headers });
  let refDomain: string | undefined;
  try {
    if (parsed.data.referrer)
      refDomain = new URL(parsed.data.referrer).hostname;
  } catch {
    /* Ignore malformed attribution. */
  }
  await deps.durable.xadd(
    keys.clicksStream,
    "*",
    "d",
    JSON.stringify({
      v: 1,
      kind: "bio_view",
      pageId: String(page._id),
      workspaceId: String(page.workspaceId),
      ts: Date.now(),
      refDomain,
      country: request.headers.get("cf-ipcountry")?.slice(0, 8),
    }),
  );
  return new Response(null, { status: 204, headers });
}
