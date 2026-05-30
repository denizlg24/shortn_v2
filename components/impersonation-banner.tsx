"use client";

import { useState } from "react";
import { authClient } from "@/lib/authClient";

export function ImpersonationBanner({ active }: { active: boolean }) {
  const [loading, setLoading] = useState(false);

  if (!active) return null;

  async function stop() {
    setLoading(true);
    try {
      await authClient.signOut();
    } finally {
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
