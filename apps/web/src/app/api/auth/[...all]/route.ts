import { auth } from "@/server/auth";
import { env } from "@/server/env";

export const GET = (request: Request) => auth().handler(request);
export const POST = async (request: Request) => {
  const response = await auth().handler(request);
  const destination = response.headers.get("location");
  // The provider resumes password, passkey and second-factor OAuth with an HTTP redirect. The auth
  // fetch client expects a JSON redirect, otherwise fetch follows it as HTML.
  if (
    env().MCP_OAUTH_ENABLED === "1" &&
    /\/(?:sign-in\/(?:email|username)|two-factor\/verify-(?:totp|backup-code)|passkey\/verify-authentication)$/.test(
      new URL(request.url).pathname,
    ) &&
    response.status >= 300 &&
    response.status < 400 &&
    destination
  ) {
    const headers = new Headers(response.headers);
    headers.delete("location");
    headers.delete("content-length");
    headers.set("content-type", "application/json");
    return Response.json({ redirect: true, url: destination }, { headers });
  }
  return response;
};
