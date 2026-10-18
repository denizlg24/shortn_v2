import { createDemoLink, parseDemoUrl } from "@shortn/core";
import { db } from "@/server/db";
import { demoConfig } from "@/server/demo";
import { env } from "@/server/env";
import {
  ipHash,
  json,
  requestIp,
  trustedOrigin,
  utcDay,
  verifyTurnstile,
  withinLimits,
} from "@/server/public-forms";
import { qrModules } from "@/server/qr-modules";
import { z } from "zod";

const demoInput = z.object({ url: z.string().max(2048), token: z.string() });

// The hero's demo shortener (20 M.5). Order matters: cheap refusals first,
// the visitor's own limits before the shared daily cap, the safety scan last.
export async function POST(request: Request) {
  const config = demoConfig();
  if (!config) return json({ error: "unavailable" }, 404);
  if (!trustedOrigin(request)) return json({ error: "unavailable" }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 4096)
    return json({ error: "invalid" }, 413);
  const input = demoInput.safeParse(await request.json().catch(() => null));
  const url = input.success ? parseDemoUrl(input.data.url) : null;
  if (!url) return json({ error: "invalid" }, 400);

  const ip = requestIp(request);
  const challenge = await verifyTurnstile(
    input.data?.token,
    ip,
    config.secretKey,
  );
  if (challenge === "failed") return json({ error: "challenge" }, 403);
  if (challenge === "unavailable") return json({ error: "unavailable" }, 503);

  const e = env();
  const visitor = ipHash(ip);
  const day = utcDay();
  try {
    if (
      !(await withinLimits([
        { key: `demo:ip:10m:${visitor}`, max: 5, seconds: 600 },
        { key: `demo:ip:day:${day}:${visitor}`, max: 20, seconds: 86_400 },
      ]))
    )
      return json({ error: "rateLimited" }, 429);
    if (
      !(await withinLimits([
        { key: `demo:created:${day}`, max: config.dailyCap, seconds: 172_800 },
      ]))
    )
      return json({ error: "capReached" }, 429);

    const result = await createDemoLink(
      {
        db: await db(),
        linkDomain: e.LINK_DOMAIN,
        ownHosts: [
          e.LINK_DOMAIN,
          new URL(e.PUBLIC_ORIGIN).hostname,
          new URL(e.BETTER_AUTH_URL).hostname,
        ],
        scan: { webRiskApiKey: e.WEB_RISK_API_KEY },
      },
      { url },
    );
    if (!result.ok)
      return json(
        { error: result.error === "invalid_url" ? "invalid" : result.error },
        result.error === "unavailable" ? 503 : 422,
      );
    const shortUrl = `https://${e.LINK_DOMAIN}/${result.value.key}`;
    return json({
      shortUrl,
      key: result.value.key,
      destination: result.value.url,
      expiresAt: result.value.expiresAt.toISOString(),
      qr: qrModules(shortUrl),
    });
  } catch {
    return json({ error: "unavailable" }, 503);
  }
}
