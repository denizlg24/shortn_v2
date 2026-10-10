import { requireWorkspace } from "@/server/workspace";

export default async function LinksPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await requireWorkspace((await params).workspace);
  return <main className="p-6">{workspace.name}</main>;
}
