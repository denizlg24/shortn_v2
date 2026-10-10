"use client";

import { buttonVariants } from "@shortn/ui";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { BreadcrumbTitle, type Crumb } from "../shell/breadcrumb-title";
import { PageHeader } from "../shell/page-header";

/**
 * A creation page (12 Superseded IA: create and manage on their own pages):
 * a breadcrumb back to where it came from, one column, one action. Cancel
 * returns to the last crumb.
 */
export function FormPage({
  trail,
  title,
  description,
  onSubmit,
  submit,
  cancelLabel,
  children,
}: {
  trail: [Crumb, ...Crumb[]];
  title: ReactNode;
  description?: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** The primary button, already labelled and wired to pending state. */
  submit: ReactNode;
  cancelLabel: string;
  children: ReactNode;
}) {
  const back = trail[trail.length - 1] ?? trail[0];
  return (
    <>
      <PageHeader
        title={<BreadcrumbTitle trail={trail}>{title}</BreadcrumbTitle>}
      />
      <div className="px-gutter pt-8 pb-12">
        <form
          noValidate
          onSubmit={onSubmit}
          className="flex max-w-140 flex-col gap-5"
        >
          {description ? (
            <p className="text-body text-pretty text-fg-muted">{description}</p>
          ) : null}
          {children}
          <div className="flex items-center gap-2 border-t border-line pt-5">
            {submit}
            <Link
              href={back.href}
              className={buttonVariants({ variant: "ghost" })}
            >
              {cancelLabel}
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
