import { getTranslations } from "next-intl/server";
import { safeNext } from "@shortn/auth";
import { mcpPreview } from "@/server/mcp-oauth";
import { McpOAuthInvalid } from "@/components/auth/mcp-oauth-parts";
import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge";

export async function generateMetadata() {
  return { title: (await getTranslations("auth.twoFactor"))("title") };
}

export default async function TwoFactorPage({
  searchParams,
}: PageProps<"/login/two-factor">) {
  const search = await searchParams;
  if (search.sig && !(await mcpPreview(search))) return <McpOAuthInvalid />;
  return (
    <TwoFactorChallenge
      next={safeNext(typeof search.next === "string" ? search.next : undefined)}
    />
  );
}
