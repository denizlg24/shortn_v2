import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-parts";
import { McpOAuthForm } from "@/components/auth/mcp-oauth-form";
import {
  McpCallback,
  McpOAuthInvalid,
} from "@/components/auth/mcp-oauth-parts";
import { mcpPageContext } from "@/server/mcp-oauth";

export default async function McpWorkspacePage({
  searchParams,
}: PageProps<"/auth/mcp/workspace">) {
  const context = await mcpPageContext(await searchParams),
    t = await getTranslations("mcpOAuth");
  if (!context) return <McpOAuthInvalid />;
  const { request, workspaces, session } = context;
  return (
    <>
      <AuthHeading
        title={t("workspace.title")}
        description={
          <span className="line-clamp-2 break-all" title={request.clientName}>
            {request.clientName}
          </span>
        }
      />
      <p className="mb-5 text-body text-fg-muted">
        {t("workspace.description")}
      </p>
      <McpOAuthForm
        phase="workspace"
        query={request.query}
        workspaces={workspaces}
        {...(typeof session.session.mcpWorkspaceId === "string"
          ? { selected: session.session.mcpWorkspaceId }
          : {})}
      />
      <div className="mt-6">
        <McpCallback address={request.redirectUri} />
      </div>
    </>
  );
}

export async function generateMetadata() {
  const t = await getTranslations("mcpOAuth");
  return {
    title: t("workspace.title"),
    robots: { index: false, follow: false },
  };
}
