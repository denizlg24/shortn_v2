import { buttonVariants } from "@shortn/ui";
import type { ReactNode } from "react";

/** A standalone page outside the console shell: sign-out, auth errors. */
export function NoticePage({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4">
      <h1 className="text-title font-semibold tracking-[-0.015em]">{title}</h1>
      <div className="text-body text-fg-muted">{children}</div>
      {action ? (
        <a
          href={action.href}
          className={buttonVariants({
            variant: "primary",
            size: "md",
            className: "mt-2 self-start",
          })}
        >
          {action.label}
        </a>
      ) : null}
    </main>
  );
}
