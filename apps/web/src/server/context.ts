import "server-only";
import type { ServiceContext } from "@shortn/core";
import { db } from "./db";
import { env } from "./env";
import { redis } from "./redis";
import { requireWorkspace } from "./workspace";

// Everything a service call needs, derived from the session: the workspace
// comes from the URL slug only after membership is checked (05).
export async function serviceContext(slug: string): Promise<ServiceContext> {
  const { workspace, actor } = await requireWorkspace(slug);
  return {
    db: await db(),
    workspace,
    actor,
    cache: (await redis()).cache,
    linkDomain: env().LINK_DOMAIN,
  };
}
