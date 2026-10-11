"use client";

import { useState } from "react";

/** A small round avatar for lists; the initial when there's none or it fails. */
export function BioAvatar({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-bg-muted text-meta font-medium text-fg-muted"
    >
      {url && !failed ? (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
