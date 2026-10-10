"use client";

import { Skeleton } from "@shortn/ui";
import { useTranslations } from "next-intl";
import type { Section } from "../shell/nav";
import { PageHeader } from "../shell/page-header";

/** Placeholder for a /new or /edit page while it loads. */
export function FormPageSkeleton({
  section,
  fields = 3,
}: {
  section: Section;
  fields?: number;
}) {
  const t = useTranslations("nav");
  return (
    <>
      <PageHeader title={t(section)} />
      <div aria-busy className="px-gutter pt-8">
        <div className="flex max-w-140 flex-col gap-5">
          <Skeleton className="h-4 w-3/4" />
          {Array.from({ length: fields }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-8 w-full rounded-control" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
