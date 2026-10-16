"use client";
import { useEffect, useState } from "react";
import {
  requestLinkMetadataAction,
  readLinkMetadataAction,
} from "@/server/actions/link-creation";
import { creationUrl } from "@/lib/link-creation";
type Lookup = {
  url: string | null;
  phase: "idle" | "loading" | "ready" | "unavailable";
  title?: string | null;
  key?: string | null;
};
export function useLinkCreation(workspace: string | undefined, input: string) {
  const url = creationUrl(input),
    [revision, retry] = useState(0),
    [lookup, setLookup] = useState<Lookup>({ url: null, phase: "idle" });
  useEffect(() => {
    if (!workspace || !url) return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      wake: (() => void) | undefined;
    const pause = () =>
      new Promise<void>((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, 1000);
      });
    const initial = setTimeout(() => {
      setLookup({ url, phase: "loading" });
      void (async () => {
        try {
          const requested = await requestLinkMetadataAction(workspace, url);
          if (cancelled) return;
          if (!requested.value) {
            setLookup({ url, phase: "unavailable" });
            return;
          }
          for (let attempt = 0; attempt < 20 && !cancelled; attempt++) {
            const result = await readLinkMetadataAction(
              workspace,
              requested.value.id,
            );
            if (cancelled) return;
            if (!result.value) {
              setLookup({ url, phase: "unavailable" });
              return;
            }
            if (result.value.state !== "pending") {
              setLookup({
                url,
                phase: result.value.state === "ready" ? "ready" : "unavailable",
                title: result.value.title,
                key: result.value.key,
              });
              return;
            }
            await pause();
          }
          if (!cancelled) setLookup({ url, phase: "unavailable" });
        } catch {
          if (!cancelled) setLookup({ url, phase: "unavailable" });
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearTimeout(timer);
      wake?.();
    };
  }, [workspace, url, revision]);
  const current: Lookup =
    lookup.url === url && workspace ? lookup : { url, phase: "idle" };
  return { lookup: current, retry: () => retry((value) => value + 1) };
}
