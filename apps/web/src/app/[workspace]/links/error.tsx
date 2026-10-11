"use client";

import { Button, EmptyState } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { PageHeader } from "@/components/shell/page-header";

export default function LinksError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("links");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState
        tone="danger"
        title={t("error.title")}
        description={t("error.body")}
        action={<Button onClick={retry}>{t("retry")}</Button>}
      />
    </>
  );
}
