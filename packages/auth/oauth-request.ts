import { constantTimeEqual, makeSignature } from "better-auth/crypto";
import { apiScopes } from "@shortn/core";
import { physicalNames } from "@shortn/db";
import type { Db } from "mongodb";

/** Browser callbacks: HTTPS, loopback HTTP, or native app private-use schemes. */
export function validMcpCallback(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:")
      return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (
      ["cursor:", "vscode:", "vscode-insiders:", "claude:"].includes(
        url.protocol,
      ) || url.protocol.includes(".")
    );
  } catch {
    return false;
  }
}

/** Read-only consent preview; the provider still validates the request at approval. */
export async function mcpOAuthRequest(
  db: Db,
  query: string,
  secret: string,
  now = new Date(),
) {
  if (!query || query.length > 16384) return null;
  const params = new URLSearchParams(query);
  if (
    [...params.keys()].some(
      (key) => key !== "ba_param" && params.getAll(key).length !== 1,
    )
  )
    return null;
  const signature = params.get("sig"),
    expiry = Number(params.get("exp"));
  if (!signature || !Number.isFinite(expiry) || expiry * 1000 < now.getTime())
    return null;
  params.delete("sig");
  const canonical = new URLSearchParams(
    [...params].sort(([a, av], [b, bv]) =>
      a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0,
    ),
  );
  if (
    !constantTimeEqual(
      signature,
      await makeSignature(canonical.toString(), secret),
    )
  )
    return null;
  const clientId = params.get("client_id"),
    redirectUri = params.get("redirect_uri"),
    scope = params.get("scope");
  if (
    !clientId ||
    clientId.length > 200 ||
    !redirectUri ||
    redirectUri.length > 2048 ||
    !validMcpCallback(redirectUri) ||
    !scope
  )
    return null;
  const scopes = [...new Set(scope.split(" ").filter(Boolean))];
  if (
    !scopes.length ||
    scopes.some(
      (value) =>
        value !== "offline_access" &&
        !apiScopes.some((known) => known === value),
    )
  )
    return null;
  const client = await db.collection(physicalNames.oauth_clients).findOne(
    { clientId },
    {
      projection: { name: 1, disabled: 1, redirectUris: 1 },
    },
  );
  if (
    !client ||
    client.disabled ||
    !Array.isArray(client.redirectUris) ||
    !client.redirectUris.includes(redirectUri)
  )
    return null;
  return {
    query,
    clientId,
    clientName:
      typeof client.name === "string" ? client.name.slice(0, 200) : clientId,
    redirectUri,
    scopes,
  };
}
