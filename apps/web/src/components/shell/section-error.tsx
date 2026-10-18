"use client";

import { Button, EmptyState } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import type { Section } from "./nav";
import { PageHeader } from "./page-header";

/** A section's error boundary body: the header stays, the content retries. */
export function SectionError({
  section,
  error,
  retry,
}: {
  section: Section;
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <>
      <PageHeader title={t(`nav.${section}`)} />
      <EmptyState
        tone="danger"
        title={t("common.error.title")}
        description={t("common.error.body")}
        action={<Button onClick={retry}>{t("common.error.retry")}</Button>}
      />
    </>
  );
}
