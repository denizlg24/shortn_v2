"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

export function AuthHeading({
  title,
  description,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Lets a form move focus here after swapping content in place. */
  id?: string;
}) {
  return (
    <div className="mb-6 flex flex-col items-center gap-1.5 text-center">
      <h1
        id={id}
        tabIndex={-1}
        className="text-title font-semibold tracking-[-0.015em] outline-none"
      >
        {title}
      </h1>
      {description ? (
        <p className="text-body text-pretty text-fg-muted">{description}</p>
      ) : null}
    </div>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex gap-2 text-small text-danger">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 text-pretty">{children}</span>
    </p>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-meta text-fg-subtle">
      <span aria-hidden className="h-px flex-1 bg-line" />
      {label}
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}

export function AuthPrompt({
  prompt,
  action,
  href,
}: {
  prompt: ReactNode;
  action: ReactNode;
  href: Route;
}) {
  return (
    <p className="mt-6 text-center text-small text-fg-muted">
      {prompt}{" "}
      <Link href={href} className="font-medium text-signal hover:underline">
        {action}
      </Link>
    </p>
  );
}

export const strong = (chunks: ReactNode) => (
  <strong className="font-medium text-fg">{chunks}</strong>
);
