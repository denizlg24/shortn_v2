import type { InvalidationStore } from "@shortn/redis";
import type { Db } from "mongodb";
import type { Actor } from "./authz";
import type { Workspace } from "./service";

// Everything a mutation needs: who acts, in which workspace, and the
// infrastructure handles. The workspace always comes from the authorized
// session, never from client input (05).
export interface ServiceContext {
  db: Db;
  workspace: Workspace;
  actor: Actor;
  cache: InvalidationStore;
  linkDomain: string;
  now?: () => Date;
}

export const nowOf = (ctx: Pick<ServiceContext, "now">) =>
  ctx.now ? ctx.now() : new Date();

// Only personal workspaces carry the legacy owner, so team-workspace data
// never appears in a user's legacy dashboard.
export const legacySubOf = (ctx: Pick<ServiceContext, "workspace">) =>
  ctx.workspace.personal ? ctx.workspace.legacySub : undefined;
