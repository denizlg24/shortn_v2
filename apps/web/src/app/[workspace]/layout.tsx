import type { Workspace } from "@shortn/core";
import { Shell } from "@/components/shell/shell";
import type { WorkspaceSummary } from "@/components/shell/types";
import { memberships, requireWorkspace } from "@/server/workspace";

const summarize = (workspace: Workspace): WorkspaceSummary => ({
  id: workspace._id.toHexString(),
  slug: workspace.slug,
  name: workspace.name,
  logo: workspace.logo ?? null,
  plan: workspace.plan,
});

export default async function WorkspaceLayout({
  children,
  params,
}: LayoutProps<"/[workspace]">) {
  const { session, workspace } = await requireWorkspace(
    (await params).workspace,
  );
  const list = await memberships(session.user.id);
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
    >
      {children}
    </Shell>
  );
}
