"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "../auth";
import { env } from "../env";
import { mcpPreview } from "../mcp-oauth";

export type McpOAuthState = {
  error?: "invalid" | "workspaceChanged" | "unavailable" | "failed";
};
export async function mcpOAuthAction(
  _state: McpOAuthState,
  form: FormData,
): Promise<McpOAuthState> {
  const query = form.get("oauth_query"),
    decision = form.get("decision"),
    phase = form.get("phase"),
    workspace = form.get("workspace");
  if (
    typeof query !== "string" ||
    !["cancel", "continue", "allow"].includes(String(decision))
  )
    return { error: "invalid" };
  const request = await mcpPreview(query);
  if (!request) return { error: "invalid" };
  const incoming = await headers();
  const invoke = async (path: string, body: Record<string, unknown>) =>
    auth().handler(
      new Request(new URL(`/api/auth${path}`, env().BETTER_AUTH_URL), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: new URL(env().BETTER_AUTH_URL).origin,
          Cookie: incoming.get("cookie") ?? "",
          ...(typeof workspace === "string"
            ? { "x-shortn-workspace": workspace }
            : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  try {
    let response: Response;
    if (decision === "cancel")
      response = await invoke("/oauth2/consent", {
        accept: false,
        oauth_query: request.query,
      });
    else if (
      phase === "workspace" &&
      decision === "continue" &&
      typeof workspace === "string"
    ) {
      const selected = await invoke("/mcp/select-workspace", {
        workspaceId: workspace,
      });
      if (!selected.ok)
        return { error: selected.status === 403 ? "unavailable" : "failed" };
      response = await invoke("/oauth2/continue", {
        postLogin: true,
        oauth_query: request.query,
      });
    } else if (
      phase === "consent" &&
      decision === "allow" &&
      typeof workspace === "string"
    )
      response = await invoke("/oauth2/consent", {
        accept: true,
        oauth_query: request.query,
      });
    else return { error: "invalid" };
    if (!response.ok)
      return {
        error:
          response.status === 409
            ? "workspaceChanged"
            : response.status === 403
              ? "unavailable"
              : "failed",
      };
    const result = z
      .object({ uri: z.string().optional(), url: z.string().optional() })
      .parse(await response.json());
    const destination = result.uri ?? result.url;
    if (!destination) return { error: "failed" };
    // The provider validates the signed request and registered callback before
    // returning this destination. Do not use a form-supplied redirect URL.
    redirect(destination);
  } catch (error) {
    if (
      error instanceof Error &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    )
      throw error;
    return { error: "failed" };
  }
}
