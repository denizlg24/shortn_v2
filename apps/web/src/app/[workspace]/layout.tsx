import type { ReactNode } from "react";
import { requireWorkspace } from "@/server/workspace";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  await requireWorkspace((await params).workspace);
  return children;
}
