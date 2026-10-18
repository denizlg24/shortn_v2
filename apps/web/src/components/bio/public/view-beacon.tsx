"use client";
import { useEffect } from "react";
export function BioViewBeacon({
  pageId,
  endpoint,
}: {
  pageId: string;
  endpoint: string;
}) {
  useEffect(() => {
    if (navigator.doNotTrack === "1" || document.visibilityState !== "visible")
      return;
    const key = `bio-view:${pageId}:${Math.floor(Date.now() / 1800000)}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* Storage is optional. */
    }
    const payload = JSON.stringify({
      pageId,
      referrer: document.referrer.slice(0, 2048),
    });
    if (
      navigator.sendBeacon(
        endpoint,
        new Blob([payload], { type: "text/plain" }),
      )
    ) {
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* Storage is optional. */
      }
    }
  }, [pageId, endpoint]);
  return null;
}
