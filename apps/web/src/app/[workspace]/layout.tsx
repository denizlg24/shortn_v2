import type { Workspace } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { Shell } from "@/components/shell/shell";
import type { UsageItem, WorkspaceSummary } from "@/components/shell/types";
import { billingOverview } from "@/server/plan";
import { memberships, requireWorkspace } from "@/server/workspace";

const summarize = (workspace: Workspace): WorkspaceSummary => ({
  id: workspace._id.toHexString(),
  slug: workspace.slug,
  name: workspace.name,
  logo: workspace.logo ?? null,
  plan: workspace.plan,
});

// The meter is secondary: a failed count leaves it out instead of failing
// every page in the workspace.
async function usageFor(slug: string): Promise<UsageItem[]> {
  try {
    const [{ usage, limits }, t] = await Promise.all([
      billingOverview(slug),
      getTranslations("shell.usage"),
    ]);
    return [
      { label: t("links"), used: usage.links, limit: limits.links },
      { label: t("qrCodes"), used: usage.qrCodes, limit: limits.qrCodes },
      { label: t("bioPages"), used: usage.bioPages, limit: limits.bioPages },
    ];
  } catch (error) {
    unstable_rethrow(error);
    console.error("usage meter failed", slug, error);
    return [];
  }
}

export default async function WorkspaceLayout({
  children,
  params,
}: LayoutProps<"/[workspace]">) {
  const slug = (await params).workspace;
  const { session, workspace } = await requireWorkspace(slug);
  const [list, usage] = await Promise.all([
    memberships(session.user.id),
    usageFor(slug),
  ]);
  return (
    <Shell
      workspace={summarize(workspace)}
      workspaces={list.map((membership) => summarize(membership.workspace))}
      user={{
        name: session.user.name || session.user.email,
        email: session.user.email,
        image: session.user.image ?? null,
      }}
      impersonating={Boolean(session.session.impersonatedBy)}
      usage={usage}
    >
      {children}
    </Shell>
  );
}
