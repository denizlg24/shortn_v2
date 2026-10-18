import { cn } from "@shortn/ui";
import type { ReactNode } from "react";

// One-line outcome of the last action ("Link created."), shown after a
// form navigates; no toasts (12).
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning";
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn(
        "mb-5 rounded-control border px-3 py-2 text-small",
        tone === "success" && "border-success/30 bg-success/5 text-fg",
        tone === "warning" && "border-warning/40 bg-warning/5 text-fg",
        tone === "info" && "border-line bg-bg-subtle text-fg",
      )}
    >
      {children}
    </p>
  );
}
