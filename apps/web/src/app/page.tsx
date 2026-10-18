import { redirect } from "next/navigation";
import { landingWorkspaceSlug, requireSession } from "@/server/workspace";

// Sections a handoff from the legacy dashboard may land on (legacy
// app/api/handoff maps its paths to these).
const sections = new Set([
  "links",
  "analytics",
  "qr",
  "bio",
  "campaigns",
  "settings",
  "settings/billing",
]);

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[] }>;
}) {
  const session = await requireSession();
  const { to } = await searchParams;
  const section = typeof to === "string" && sections.has(to) ? to : "links";
  redirect(`/${await landingWorkspaceSlug(session)}/${section}`);
}
