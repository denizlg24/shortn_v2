"use client";

import { useState } from "react";
import { authClient } from "@/lib/authClient";

export function ImpersonationBanner({ active }: { active: boolean }) {
  const [loading, setLoading] = useState(false);

  if (!active) return null;

  async function stop() {
    setLoading(true);
    try {
      // Call the stop-impersonation endpoint to restore admin session
      const response = await fetch("/api/auth/stop-impersonation", {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();

      if (result.success && result.restored) {
        // Admin session restored - redirect to dashboard
        window.location.href = "/en/dashboard";
      } else {
        // No admin session to restore - sign out normally
        await authClient.signOut();
        window.location.href = "/en/dashboard/logout";
      }
    } catch (error) {
      console.error("Failed to stop impersonation:", error);
      // Fallback to normal sign out
      await authClient.signOut();
      window.location.href = "/en/dashboard/logout";
    }
  }

  return (
    <div className="fixed top-0 left-0 z-[100] flex w-full items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-amber-950 sm:text-sm">
      <span>
        You are viewing this account as an administrator (impersonation).
      </span>
      <button
        onClick={stop}
        disabled={loading}
        className="rounded-md bg-amber-950/10 px-2 py-0.5 font-semibold underline-offset-2 hover:bg-amber-950/20 disabled:opacity-50"
      >
        Stop impersonating
      </button>
    </div>
  );
}
