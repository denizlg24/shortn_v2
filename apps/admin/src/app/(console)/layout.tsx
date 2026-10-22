import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { requireAdmin } from "@/server/session";

export default async function ConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { admin } = await requireAdmin();
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg md:flex-row">
      <Sidebar email={admin.email} role={admin.role} />
      <main
        id="main"
        className="relative flex min-w-0 flex-1 flex-col overflow-y-auto"
      >
        {children}
      </main>
    </div>
  );
}
