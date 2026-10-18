"use client";

import { useEffect } from "react";
import { useChangelogSeen } from "@/lib/changelog/use-changelog-seen";

/** Reading the changelog page counts as seeing the latest entry. */
export function MarkChangelogSeen() {
  const { markSeen } = useChangelogSeen();
  useEffect(() => markSeen(), [markSeen]);
  return null;
}
