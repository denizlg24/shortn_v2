import { invalidateLinks } from "@shortn/redis";
import { Redis } from "ioredis";
import env from "@/utils/env";

const LINK_DOMAIN = "shortn.at";

let client: Redis | undefined;
let connecting: Promise<void> | undefined;

async function getClient(url: string): Promise<Redis> {
  if (!client) {
    client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: 1000,
      connectTimeout: 1000,
    });
  }
  if (client.status === "wait" || client.status === "end") {
    connecting ??= client.connect().finally(() => {
      connecting = undefined;
    });
  }
  if (connecting) await connecting;
  return client;
}

// Failures are logged rather than thrown: the change-stream consumer is the
// safety net for any invalidation missed here.
export async function invalidateLinkCache(
  codes: Iterable<string | null | undefined>,
): Promise<void> {
  const url = env.REDIS_CACHE_URL;
  if (!url) return;
  const keys = [...codes].filter((code): code is string => !!code);
  if (!keys.length) return;
  try {
    const redis = await getClient(url);
    await invalidateLinks(redis, LINK_DOMAIN, keys);
  } catch (error) {
    console.error("[invalidateLinkCache] failed:", error);
  }
}
