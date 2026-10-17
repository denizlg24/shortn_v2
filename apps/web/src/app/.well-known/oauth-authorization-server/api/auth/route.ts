import { auth } from "@/server/auth";
import { env } from "@/server/env";

// RFC 8414 discovery for the /api/auth issuer. SDK owns the metadata contents.
export async function GET(request: Request) {
  if (env().MCP_OAUTH_ENABLED !== "1")
    return new Response(null, { status: 404 });
  const method: unknown = Reflect.get(auth().api, "getOAuthServerConfig");
  if (typeof method !== "function") return new Response(null, { status: 404 });
  const response: unknown = await method({
    asResponse: true,
    headers: request.headers,
  });
  if (!(response instanceof Response))
    return new Response(null, { status: 503 });
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "public, max-age=300");
  return new Response(response.body, { status: response.status, headers });
}
