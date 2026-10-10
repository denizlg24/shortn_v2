"use client";

import { cn } from "@shortn/ui";
import { useState } from "react";

const initialOf = (name: string) =>
  (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase();

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(initialOf)
    .join("") || "?";

export function WorkspaceAvatar({
  name,
  logo,
  size,
}: {
  name: string;
  logo: string | null;
  size: 16 | 24;
}) {
  const [broken, setBroken] = useState(false);
  const box = size === 24 ? "size-6 text-meta" : "size-4 text-[10px]";
  if (logo && !broken)
    return (
      <img
        src={logo}
        alt=""
        onError={() => setBroken(true)}
        className={cn("shrink-0 rounded-chip object-cover", box)}
      />
    );
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-chip bg-fg/10 leading-none font-semibold text-fg",
        box,
      )}
    >
      {initialOf(name)}
    </span>
  );
}

export function UserAvatar({
  name,
  image,
}: {
  name: string;
  image: string | null;
}) {
  const [broken, setBroken] = useState(false);
  if (image && !broken)
    return (
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-6 shrink-0 rounded-full bg-fg/10 object-cover"
      />
    );
  return (
    <span
      aria-hidden
      className="grid size-6 shrink-0 place-items-center rounded-full bg-fg/10 text-meta font-semibold text-fg"
    >
      {initialsOf(name)}
    </span>
  );
}
