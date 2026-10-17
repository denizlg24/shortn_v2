"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pastedCreationUrl } from "@/lib/link-creation";
export function LinkPasteCapture({ workspace }: { workspace: string }) {
  const router = useRouter();
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (
        event.defaultPrevented ||
        !(event.target instanceof Element) ||
        (event.target instanceof HTMLElement &&
          event.target.isContentEditable) ||
        event.target.closest('input,textarea,select,[role="textbox"]')
      )
        return;
      const url = pastedCreationUrl(
        event.clipboardData?.getData("text/plain") ?? "",
      );
      if (!url) return;
      event.preventDefault();
      router.push(`/${workspace}/links/new?url=${encodeURIComponent(url)}`);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [router, workspace]);
  return null;
}
