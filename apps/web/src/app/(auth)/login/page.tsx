import { safeNext } from "@shortn/auth";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { parseOAuthFailure } from "@/components/auth/oauth-failure";
import { socialProviders } from "@/server/auth";
import { leaveIfSignedIn } from "@/server/auth-redirect";
import { LoginForm } from "./login-form";
import { mcpPreview } from "@/server/mcp-oauth";
import { McpOAuthInvalid } from "@/components/auth/mcp-oauth-parts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

// `next` brings the user back after signing in (e.g. an invite link); only
// same-app relative paths pass, so it can't become an open redirect.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const search = await searchParams,
    { error, next } = search;
  if (search.sig) {
    if (!(await mcpPreview(search))) return <McpOAuthInvalid />;
  } else await leaveIfSignedIn(next);
  const ssoQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(search))
    if (Array.isArray(value))
      for (const item of value) ssoQuery.append(key, item);
    else if (typeof value === "string") ssoQuery.append(key, value);
  return (
    <LoginForm
      ssoHref={`/login/sso${ssoQuery.size ? `?${ssoQuery}` : ""}`}
      oauthFailure={parseOAuthFailure(error)}
      providers={socialProviders()}
      next={safeNext(typeof next === "string" ? next : undefined)}
    />
  );
}
