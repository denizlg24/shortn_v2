import { safeNext } from "@shortn/auth";
import { getTranslations } from "next-intl/server";
import { McpOAuthInvalid } from "@/components/auth/mcp-oauth-parts";
import { SsoLoginForm } from "@/components/auth/sso-login-form";
import { leaveIfSignedIn } from "@/server/auth-redirect";
import { mcpPreview } from "@/server/mcp-oauth";

export async function generateMetadata() {
  const t = await getTranslations("auth.sso");
  return { title: t("title") };
}
export default async function SsoLoginPage({
  searchParams,
}: PageProps<"/login/sso">) {
  const search = await searchParams,
    next = safeNext(typeof search.next === "string" ? search.next : undefined);
  const query = new URLSearchParams();
  const signedNames = new Set(
    Array.isArray(search.ba_param)
      ? search.ba_param
      : typeof search.ba_param === "string"
        ? [search.ba_param]
        : [],
  );
  for (const [key, value] of Object.entries(search)) {
    if (
      search.sig &&
      key !== "sig" &&
      key !== "ba_param" &&
      !signedNames.has(key)
    )
      continue;
    if (Array.isArray(value)) for (const item of value) query.append(key, item);
    else if (typeof value === "string") query.append(key, value);
  }
  if (search.sig) {
    if (!(await mcpPreview(query.toString()))) return <McpOAuthInvalid />;
  } else await leaveIfSignedIn(next);
  return (
    <SsoLoginForm
      next={next}
      backHref={`/login${query.size ? `?${query}` : ""}`}
      errorCode={typeof search.error === "string" ? search.error : null}
    />
  );
}
