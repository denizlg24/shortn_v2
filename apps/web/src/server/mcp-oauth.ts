import "server-only";
import { mcpOAuthRequest } from "@shortn/auth";
import { collection } from "@shortn/db";
import { platformFeatureEnabled } from "@shortn/core";
import { getSession } from "./auth";
import { db } from "./db";
import { env } from "./env";
import { redirect } from "next/navigation";

export type OAuthSearch = Record<string, string | string[] | undefined>;
export async function mcpPreview(search: OAuthSearch | string) {
  const e = env();
  if (e.MCP_OAUTH_ENABLED !== "1") return null;
  if (
    typeof search !== "string" &&
    Object.entries(search).some(
      ([key, value]) => key !== "ba_param" && Array.isArray(value),
    )
  )
    return null;
  const query =
    typeof search === "string"
      ? search
      : new URLSearchParams(
          Object.entries(search).flatMap(([key, value]) =>
            typeof value === "string"
              ? [[key, value]]
              : key === "ba_param" && Array.isArray(value)
                ? value.map((item) => [key, item])
                : [],
          ),
        ).toString();
  return mcpOAuthRequest(await db(), query, e.BETTER_AUTH_SECRET);
}

export async function mcpPageContext(search: OAuthSearch) {
  const request = await mcpPreview(search);
  if (!request) return null;
  const session = await getSession();
  if (!session) redirect(`/login?${request.query}`);
  const database = await db();
  // Only workspace choices are loaded; this flow never reads the link library.
  const members = await collection(database, "workspace_members")
    .find({ userId: session.user.id })
    .toArray();
  const workspaces = await collection(database, "workspaces")
    .find(
      { _id: { $in: members.map((item) => item.workspaceId) } },
      { projection: { name: 1, platformFeatures: 1 } },
    )
    .sort({ name: 1, _id: 1 })
    .toArray();
  const roles = new Map(
    members.map((item) => [item.workspaceId.toHexString(), item.role]),
  );
  return {
    request,
    session,
    workspaces: workspaces
      .filter((item) =>
        platformFeatureEnabled(item, "mcp", env().PLATFORM_MCP_ROLLOUT),
      )
      .map((item) => ({
        id: item._id.toHexString(),
        name: item.name,
        role: roles.get(item._id.toHexString())!,
      })),
  };
}
