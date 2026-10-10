import { redirect } from "next/navigation";
import { landingWorkspaceSlug, requireSession } from "@/server/workspace";

export default async function Home() {
  const session = await requireSession();
  redirect(`/${await landingWorkspaceSlug(session)}/links`);
}
