import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-parts";
import { McpOAuthForm } from "@/components/auth/mcp-oauth-form";
import {
  McpCallback,
  McpOAuthInvalid,
} from "@/components/auth/mcp-oauth-parts";
import { mcpPageContext } from "@/server/mcp-oauth";
import { redirect } from "next/navigation";
import type mcpMessages from "../../../../../../messages/en/mcpOAuth.json";

export default async function McpConsentPage({
  searchParams,
}: PageProps<"/auth/mcp/consent">) {
  const context = await mcpPageContext(await searchParams),
    t = await getTranslations("mcpOAuth");
  if (!context) return <McpOAuthInvalid />;
  const { request, workspaces, session } = context;
  const selected = workspaces.find(
    (item) => item.id === session.session.mcpWorkspaceId,
  );
  if (!selected) redirect(`/auth/mcp/workspace?${request.query}`);
  const scopes = request.scopes.filter((scope) => {
    const [resource, mode] = scope.split(":");
    return mode === "*" || !request.scopes.includes(`${resource}:*`);
  });
  return (
    <>
      <AuthHeading
        title={t("consent.title")}
        description={
          <span className="line-clamp-2 break-all" title={request.clientName}>
            {request.clientName}
          </span>
        }
      />
      <div className="mb-5 flex flex-col gap-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-small text-fg-muted">{t("workspace.label")}</p>
            <p
              className="line-clamp-2 break-all text-body font-medium"
              title={selected.name}
            >
              {selected.name}
            </p>
            <p className="text-meta text-fg-muted">
              {t(`roles.${selected.role}`)}
            </p>
          </div>
          <Link
            href={`/auth/mcp/workspace?${request.query}`}
            className="shrink-0 text-small font-medium text-signal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            {t("change")}
          </Link>
        </div>
        <div className="border-t border-line pt-4">
          <h2 className="mb-2 text-small font-medium">{t("permissions")}</h2>
          <ul className="flex flex-col gap-2 text-small">
            {scopes.map((scope) => (
              <li key={scope}>
                {t(
                  `scopes.${scope.replaceAll(":", "_").replace("*", "all") as keyof typeof mcpMessages.scopes}`,
                )}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-small text-fg-muted">
          {t(selected.role === "viewer" ? "viewerLimit" : "roleLimit")}
        </p>
        <McpCallback address={request.redirectUri} />
        <p className="text-small text-fg-muted">{t("sessionLimit")}</p>
      </div>
      <McpOAuthForm
        phase="consent"
        query={request.query}
        workspaces={workspaces}
        selected={selected.id}
      />
    </>
  );
}

export async function generateMetadata() {
  const t = await getTranslations("mcpOAuth");
  return { title: t("consent.title"), robots: { index: false, follow: false } };
}
