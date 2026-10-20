import {
  paidStatuses,
  resolveEntitlements,
  type PlanId,
} from "@shortn/billing";
import { collection } from "@shortn/db";
import { db } from "@/server/db";
import type { Workspace } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { Shell } from "@/components/shell/shell";
import {
  WorkspaceStatusBanner,
  WorkspaceSuspensionGate,
} from "@/components/shell/workspace-status";
import type { UsageItem, WorkspaceSummary } from "@/components/shell/types";
import { billingOverview } from "@/server/plan";
import { memberships, requireWorkspace } from "@/server/workspace";

const summarize = (workspace: Workspace, plan: PlanId): WorkspaceSummary => ({
  id: workspace._id.toHexString(),
  slug: workspace.slug,
  name: workspace.name,
  logo: workspace.logo ?? null,
  plan,
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
  // Workspace.plan is a migration-era snapshot. Match billing and feature
  // gates by resolving the subscription mirror and any staff override, in one
  // query for the switcher.
  const subscriptions = await collection(await db(), "subscriptions")
    .find({
      workspaceId: { $in: list.map((item) => item.workspace._id) },
      status: { $in: [...paidStatuses] },
    })
    .toArray();
  const workspaces = list.map(({ workspace: item }) =>
    summarize(
      item,
      resolveEntitlements(
        subscriptions.filter((sub) => sub.workspaceId.equals(item._id)),
        new Date(),
        item.entitlementOverride,
      ).plan,
    ),
  );
  const active = workspaces.find(
    (item) => item.id === workspace._id.toHexString(),
  );
  if (!active) throw new Error("Active workspace is missing from memberships");
  // Mutations are refused in core (the actor is read-only); the banner and
  // gate only explain it and hide all but billing/exports when suspended.
  const suspension = workspace.suspension;
  return (
    <Shell
      workspace={active}
      workspaces={workspaces}
      user={{
        name: session.user.name || session.user.email,
        email: session.user.email,
        image: session.user.image ?? null,
      }}
      impersonating={Boolean(session.session.impersonatedBy)}
      usage={usage}
      notice={
        suspension ? (
          <WorkspaceStatusBanner suspension={suspension} slug={slug} />
        ) : null
      }
    >
      {suspension ? (
        <WorkspaceSuspensionGate suspension={suspension} slug={slug}>
          {children}
        </WorkspaceSuspensionGate>
      ) : (
        children
      )}
    </Shell>
  );
}
